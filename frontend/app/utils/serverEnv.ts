import { str, envsafe } from 'envsafe';
import { envClient } from "./clientEnv";

if (typeof window != 'undefined') {
  throw new Error('This should only be incldued on the client (but the env vars wont be exposed)')
}

export const envServer = {
  ...envClient,
  ...envsafe({
    INVITE_CODE_KEY: str({desc: "Key used to encrypt session data."})
    }, {
    strict: true
  })
}