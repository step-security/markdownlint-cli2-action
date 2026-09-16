// @ts-check

import fs from "node:fs";
import axios from "axios";
import * as core from "@actions/core";
import { main as markdownlintCli2 } from "markdownlint-cli2";

// eslint-disable-next-line max-lines-per-function
const validateSubscription = async () => {
  // eslint-disable-next-line unicorn/no-null
  let repoPrivate = null;
  // eslint-disable-next-line n/no-process-env
  const eventPath = process.env.GITHUB_EVENT_PATH;
  // eslint-disable-next-line n/no-sync
  if (eventPath && fs.existsSync(eventPath)) {
    // eslint-disable-next-line n/no-sync
    const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    repoPrivate = payload?.repository?.private;
  }

  const upstream = "davidanson/markdownlint-cli2-action";
  // eslint-disable-next-line n/no-process-env
  const action = process.env.GITHUB_ACTION_REPOSITORY;
  const documentationUrl = "https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions";
  core.info("");
  core.info("\u{1B}[1;36mStepSecurity Maintained Action\u{1B}[0m");
  core.info(`Secure drop-in replacement for ${upstream}`);
  if (repoPrivate === false) {
    core.info("\u{1B}[32m\u{2713} Free for public repositories\u{1B}[0m");
  }
  core.info(`\u{1B}[36mLearn more:\u{1B}[0m ${documentationUrl}`);
  core.info("");
  if (repoPrivate === false) {
    return;
  }
  // eslint-disable-next-line n/no-process-env
  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  /** @type {{ "action": string; ghes_server?: string }} */
  const body = { "action": action || "" };
  if (serverUrl !== "https://github.com") {
    // eslint-disable-next-line camelcase
    body.ghes_server = serverUrl;
  }
  try {
    await axios.post(
      // eslint-disable-next-line n/no-process-env
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body, { "timeout": 3000 }
    );
  }
  catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      core.error(`\u{1B}[1;31mThis action requires a StepSecurity subscription for private repositories.\u{1B}[0m`);
      core.error(`\u{1B}[31mLearn how to enable a subscription: ${documentationUrl}\u{1B}[0m`);
      // eslint-disable-next-line n/no-process-exit, unicorn/no-process-exit
      process.exit(1);
    }
    core.info("Timeout or API not reachable. Continuing to next step.");
  }
};

// eslint-disable-next-line n/no-top-level-await
await validateSubscription();

const logMessage = core.info;
const outputFormatter = (/** @type {import("markdownlint-cli2").OutputFormatterOptions} */ options) => {
  const { results } = options;
  for (const lintError of results) {
    const {
      errorContext,
      errorDetail,
      errorRange,
      fileName,
      lineNumber,
      ruleDescription,
      ruleInformation,
      ruleNames
    } = lintError;
    const line = `:${lineNumber}`;
    const column = errorRange ? `:${errorRange[0]}` : "";
    const name = ruleNames.join("/");
    const detail = errorDetail ? ` [${errorDetail}]` : "";
    const context = errorContext ? ` [Context: "${errorContext}"]` : "";
    const information = ruleInformation ? ` ${ruleInformation}` : "";
    const message =
      `${fileName}${line}${column} ${name} ${ruleDescription}${detail}${context}${information}`;
    /** @type {import("@actions/core").AnnotationProperties} */
    const annotation = {
      "title": ruleDescription,
      "file": fileName,
      "startLine": lineNumber,
      "endLine": lineNumber
    };
    if (errorRange) {
      const [
        errorColumn,
        errorLength
      ] = errorRange;
      annotation.startColumn = errorColumn;
      annotation.endColumn = errorColumn + errorLength - 1;
    }
    core.error(message, annotation);
  }
};

const separator = core.getInput("separator") || "\n";
const argv =
  core.getInput("globs").
    split(separator).
    filter(String);

const config = core.getInput("config");
if (config) {
  argv.push("--config", config);
}
const configPointer = core.getInput("configPointer");
if (configPointer) {
  argv.push("--configPointer", configPointer);
}
// eslint-disable-next-line unicorn/consistent-boolean-name
const fix = Boolean(core.getBooleanInput("fix"));
if (fix) {
  argv.push("--fix");
}

/** @type {import("markdownlint-cli2").Parameters} */
const parameters = {
  argv,
  logMessage,
  "optionsOverride": {
    "outputFormatters": [
      // @ts-ignore
      [ outputFormatter ]
    ]
  }
};
markdownlintCli2(parameters).then(
  (code) => code && core.setFailed(`Failed with exit code: ${code}`)
).catch(
  (error) => core.setFailed(`Failed due to error: ${error}`)
);
