import { dag, Directory, object, func } from "@dagger.io/dagger";

/**
 * CorpoPay Web — Dagger CI module.
 *
 * Single source of truth for the portable quality gate (check), invoked from
 * both GitHub Actions and GitLab CI so they stop maintaining divergent check
 * definitions.
 */
@object()
export class CorpopayWeb {
  /**
   * Run the quality gate: install → typecheck → lint → test.
   */
  @func()
  async check(src: Directory): Promise<string> {
    return dag
      .container()
      .from("node:24-slim")
      .withEnvVariable("NEXT_PUBLIC_API_URL", "http://localhost:4000")
      .withMountedDirectory("/src", src)
      .withWorkdir("/src")
      .withExec(["npm", "ci"])
      .withExec(["npm", "run", "typecheck"])
      .withExec(["npm", "run", "lint"])
      .withExec(["npm", "run", "test"])
      .stdout();
  }
}
