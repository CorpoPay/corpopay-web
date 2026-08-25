import { type Directory, dag, func, object, type Secret } from "@dagger.io/dagger";

/**
 * CorpoPay Web — Dagger CI module.
 *
 * Single source of truth for the portable quality gate (check) and the image
 * build/publish (publish). Both GitHub Actions and GitLab CI invoke these so
 * they stop maintaining divergent check definitions.
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

  /**
   * Build and publish the web image to GHCR, baking NEXT_PUBLIC_API_URL at
   * build time (defaults to the local demo API URL).
   */
  @func()
  async publish(
    src: Directory,
    tag: string,
    registryPassword: Secret,
    nextPublicApiUrl: string = "http://localhost:4000",
  ): Promise<string> {
    return dag
      .container()
      .build(src, {
        dockerfile: "Dockerfile",
        buildArgs: [{ name: "NEXT_PUBLIC_API_URL", value: nextPublicApiUrl }],
      })
      .withRegistryAuth("ghcr.io", "corpopay", registryPassword)
      .publish(`ghcr.io/corpopay/corpopay-web:${tag}`);
  }
}
