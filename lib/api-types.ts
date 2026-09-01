// The web consumes the contract from the vendored copy in `contract/` — generated
// by corpopay-api's `contract:generate` and kept in sync by the CI `contract:sync`
// drift gate (which fetches the GitLab fork's `dev` copy and diffs it).
export type { components, paths } from "../contract/api-types";
