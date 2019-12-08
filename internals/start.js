#!/usr/bin/env node

const webpack = require('webpack')
const ProgressPlugin = require('webpack/lib/ProgressPlugin')
const Listr = require('listr')
const { Observable } = require('rxjs')
const express = require('express')
const execa = require('execa')
const webpackHotMiddleware = require('webpack-hot-middleware')
const webpackDevMiddleware = require('webpack-dev-middleware')
const winston = require('winston')
const path = require('path')

const webpackDir = path.resolve(__dirname, '../.webpack')


const rendererLogger = winston.createLogger({
  format: winston.format.simple(),
  transports: [
    new winston.transports.File({
      filename: 'renderer.log',
    }),
  ]
})

const createRendererConfig = (mode, config) => {
  const entry =
    mode === 'development'
      ? Array.isArray(config.entry)
        ? ['webpack-hot-middleware/client', ...config.entry]
        : ['webpack-hot-middleware/client', config.entry]
      : config.entry

  const plugins =
    mode === 'development'
      ? [...config.plugins, new webpack.HotModuleReplacementPlugin()]
      : config.plugins

  const alias =
    mode === 'development'
      ? { ...config.resolve.alias, 'react-dom': '@hot-loader/react-dom' }
      : config.resolve.alias

  return {
    ...config,
    mode: mode === 'production' ? 'production' : 'development',
    entry,
    plugins,
    resolve: {
      ...config.resolve,
      alias,
    },
  }
}

const configs = {
  renderer: createRendererConfig('development', require('../renderer.webpack.config')),
  main: require('../main.webpack.config'),
}

const runWebpack = (config) =>
  new Observable(observer => {
    const compiler = webpack(config)

    compiler.apply(
      new ProgressPlugin((percentage, msg) => {
        observer.next(`${msg} ${Math.floor(percentage * 100)}%`)
      }),
    )

    compiler.run((err, stats) => {
      if (err) {
        return observer.error(err)
      }
      if (stats.hasErrors()) {
        return observer.error(stats.toString({ colors: true }))
      }
      observer.complete()
    })
  })

const runWebpackDevServer = config =>
  new Observable(observer => {
    const compiler = webpack(config)

    compiler.apply(
      new ProgressPlugin((percentage, msg) => {
        observer.next(`${msg} ${Math.floor(percentage * 100)}%`)
      }),
    )

    const devServer = webpackDevMiddleware(compiler, {
      publicPath: config.output.publicPath,
      logger: {
        debug: rendererLogger.debug.bind(rendererLogger),
        log: rendererLogger.log.bind(rendererLogger),
        info: rendererLogger.info.bind(rendererLogger),
        error: rendererLogger.error.bind(rendererLogger),
        warn: rendererLogger.warn.bind(rendererLogger),
      }
    })

    const server = express()
    server.use(devServer)
    server.use(webpackHotMiddleware(compiler))

    server.listen(8080, () => {
      observer.complete()
    })
  })

const mainTasks = new Listr([
  {
    title: 'Building bundles',
    task: () => new Listr(
      [
        {
          title: '- main',
          task: () => {
            return runWebpack(configs.main)
          },
        },
        {
          title: '- renderer',
          task: () => {
            return runWebpackDevServer(configs.renderer)
          },
        },
      ],
      { concurrent: true },
    )
  },
  {
    title: 'Starting electron',
    task: async ctx => {
      const electronRuntime = execa('./node_modules/.bin/electron', ['./dist/main/main.bundle.js'])
      ctx.electronRuntime = electronRuntime
    },
  },
])

mainTasks.run().catch(err => {
  console.log('ERROR: ', err)
})
