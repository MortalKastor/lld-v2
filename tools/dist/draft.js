const Octokit = require("@octokit/rest");

class Draft {
  constructor(repo, tag, token) {
    this.repo = repo;
    this.tag = tag;
    this.octokit = new Octokit({ auth: token });

    console.log({ auth: token });
  }

  async check() {
    const { repo, tag, octokit } = this;

    try {
      const { data } = await octokit.repos.getReleaseByTag({ ...repo, tag });

      if (data.draft) {
        return true;
      }

      throw new Error(`A release tagged ${tag} exists but is not a draft.`);
    } catch (e) {
      if (e.status === 404) {
        return false;
      }

      throw new Error(
        `Got HTTP status ${status} when trying to fetch the release for tag '${tag}'.`,
      );
    }
  }

  async create() {
    const { repo, tag, octokit } = this;
    const params = {
      ...repo,
      tag_name: tag,
      name: tag,
      draft: true,
      prerelease: true,
    };

    const { status } = await octokit.repos.createRelease(params);

    if (status !== 201) {
      throw new Error(`Got HTTP status ${status} when trying to create the release draft.`);
    }
  }
}

module.exports = Draft;
