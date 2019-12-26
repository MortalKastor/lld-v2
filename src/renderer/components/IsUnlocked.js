// @flow
import React, { useCallback, useState, useMemo } from "react";
import { remote } from "electron";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { PasswordIncorrectError } from "@ledgerhq/errors";

import IconTriangleWarning from "~/renderer/icons/TriangleWarning";

import db from "~/helpers/db";
import { hardReset } from "~/renderer/reset";

import { fetchAccounts } from "~/renderer/actions/accounts";
import { unlock } from "~/renderer/actions/application";
import { isLocked as isLockedSelector } from "~/renderer/reducers/application";

import Box from "~/renderer/components/Box";
import InputPassword from "~/renderer/components/InputPassword";
import LedgerLiveLogo from "~/renderer/components/LedgerLiveLogo";
import Button from "~/renderer/components/Button";
import ConfirmModal from "~/renderer/modals/ConfirmModal";
import type { ThemedComponent } from "~/renderer/styles/StyleProvider";
import IconArrowRight from "~/renderer/icons/ArrowRight";
import LedgerLiveImg from "~/renderer/images/ledgerlive-logo.svg";

type InputValue = {
  password: string,
};

type MaybeError = ?Error;

type Props = {
  children: any,
};

export const PageTitle: ThemedComponent<{}> = styled(Box).attrs(() => ({
  ff: "Inter|Regular",
  fontSize: 7,
  color: "palette.text.shade100",
}))``;

export const LockScreenDesc: ThemedComponent<{}> = styled(Box).attrs(() => ({
  ff: "Inter|Regular",
  fontSize: 4,
  textAlign: "center",
  color: "palette.text.shade80",
}))`
  margin: 10px auto 25px;
`;

const IconWrapperCircle = styled(Box)`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #ea2e4919;
  text-align: -webkit-center;
  justify-content: center;
`;

const IsUnlocked = ({ children }: Props) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState<InputValue>({ password: "" });
  const [incorrectPassword, setIncorrectPassword] = useState<MaybeError>(null);
  const [isHardResetting, setIsHardResetting] = useState(false);
  const [isHardResetModalOpened, setIsHardResetModalOpened] = useState(false);
  const isLocked = useSelector(isLockedSelector);

  const handleChangeInput = useCallback(
    (key: $Keys<InputValue>) => (value: $Values<InputValue>) => {
      setInputValue({
        ...inputValue,
        [key]: value,
      });
      setIncorrectPassword(null);
    },
  );

  const handleSubmit = useCallback(
    async (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();

      const isAccountDecrypted = await db.hasBeenDecrypted("app", "accounts");
      try {
        if (!isAccountDecrypted) {
          await db.setEncryptionKey("app", "accounts", inputValue.password);
          await dispatch(fetchAccounts());
        } else if (!db.isEncryptionKeyCorrect("app", "accounts", inputValue.password)) {
          throw new PasswordIncorrectError();
        }
        dispatch(unlock());
      } catch (error) {
        setIncorrectPassword(new PasswordIncorrectError());
      }
    },
    [inputValue, dispatch],
  );

  const handleOpenHardResetModal = useCallback(() => setIsHardResetModalOpened(true), [
    setIsHardResetModalOpened,
  ]);
  const handleCloseHardResetModal = useCallback(() => setIsHardResetModalOpened(false), [
    setIsHardResetModalOpened,
  ]);

  const handleHardReset = useCallback(async () => {
    setIsHardResetting(true);
    try {
      await hardReset();
      remote.getCurrentWindow().webContents.reloadIgnoringCache();
    } catch (error) {
      setIsHardResetting(false);
    }
  }, []);

  const hardResetIconRender = useMemo(() => (
    <IconWrapperCircle color="alertRed">
      <IconTriangleWarning width={23} height={21} />
    </IconWrapperCircle>
  ));

  if (isLocked) {
    return (
      <Box sticky alignItems="center" justifyContent="center">
        <form onSubmit={handleSubmit}>
          <Box alignItems="center">
            <LedgerLiveLogo
              style={{ marginBottom: 40 }}
              icon={<img src={LedgerLiveImg} alt="" draggable="false" width={50} height={50} />}
            />
            <PageTitle>{t("common.lockScreen.title")}</PageTitle>
            <LockScreenDesc>
              {t("common.lockScreen.subTitle")}
              <br />
              {t("common.lockScreen.description")}
            </LockScreenDesc>
            <Box horizontal alignItems="center">
              <Box style={{ width: 280 }}>
                <InputPassword
                  autoFocus
                  placeholder={t("common.lockScreen.inputPlaceholder")}
                  type="password"
                  onChange={handleChangeInput("password")}
                  value={inputValue.password}
                  error={incorrectPassword}
                />
              </Box>
              <Box ml={2}>
                <Button
                  onClick={handleSubmit}
                  primary
                  flow={1}
                  style={{ width: 46, height: 46, padding: 0, justifyContent: "center" }}
                >
                  <Box alignItems="center">
                    <IconArrowRight size={20} />
                  </Box>
                </Button>
              </Box>
            </Box>
            <Button type="button" mt={3} small onClick={handleOpenHardResetModal}>
              {t("common.lockScreen.lostPassword")}
            </Button>
          </Box>
        </form>
        <ConfirmModal
          analyticsName="HardReset"
          isDanger
          centered
          isLoading={isHardResetting}
          isOpened={isHardResetModalOpened}
          onClose={handleCloseHardResetModal}
          onReject={handleCloseHardResetModal}
          onConfirm={handleHardReset}
          confirmText={t("common.reset")}
          title={t("settings.hardResetModal.title")}
          desc={t("settings.hardResetModal.desc")}
          renderIcon={hardResetIconRender}
        />
      </Box>
    );
  }

  return children;
};

export default IsUnlocked;
