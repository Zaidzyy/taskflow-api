// TaskFlow API — Declarative Jenkins CI/CD pipeline
// SIT223/SIT753 HD Task: 7 stages — Build, Test, Code Quality, Security,
// Deploy, Release, Monitoring — with fail-loud gating and smooth transitions.
//
// Assumes the Jenkins agent has: docker CLI (socket mounted), Node 20, Trivy,
// sonar-scanner, and curl available on PATH. The provided jenkins/Dockerfile
// builds a controller image with all of these baked in (see SETUP.md).

pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '15'))
  }

  parameters {
    booleanParam(name: 'RUN_QUALITY_GATE', defaultValue: true,
      description: 'Block on the SonarQube quality gate (needs a Sonar webhook back to Jenkins).')
    string(name: 'SONAR_HOST_URL', defaultValue: 'http://host.docker.internal:9000',
      description: 'SonarQube base URL reachable from the Jenkins agent (host.docker.internal reaches host-published ports on Docker Desktop/WSL2).')
    string(name: 'PROMETHEUS_URL', defaultValue: 'http://host.docker.internal:9090',
      description: 'Prometheus base URL (host-published port of the docker-compose stack).')
    string(name: 'APP_URL', defaultValue: 'http://host.docker.internal:3000',
      description: 'Staging app base URL as seen from the Jenkins agent.')
    booleanParam(name: 'PUSH_GIT_TAG', defaultValue: false,
      description: 'Also push the release git tag to origin so it appears on GitHub (requires a username/password credential with id "github-token", e.g. a Personal Access Token).')
  }

  environment {
    IMAGE_NAME    = 'taskflow-api'
    // Immutable, traceable version: 1.0.<build> tied to the git commit.
    APP_VERSION   = "1.0.${env.BUILD_NUMBER}"
    REGISTRY      = 'localhost:5000'          // local registry; override for a real one
    ARTIFACT_DIR  = 'reports'
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA   = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.IMAGE_TAG = "${APP_VERSION}-${env.GIT_SHA}"
        }
        sh 'mkdir -p ${ARTIFACT_DIR}'
        echo "Building ${IMAGE_NAME}:${IMAGE_TAG} (commit ${GIT_SHA})"
      }
    }

    // ------------------------------------------------------------------
    // 1. BUILD — produce a versioned, tagged Docker image (the artifact)
    // ------------------------------------------------------------------
    stage('Build') {
      steps {
        echo '== Build: creating tagged Docker image artifact =='
        sh '''
          set -euo pipefail
          docker build \
            --build-arg APP_VERSION=${APP_VERSION} \
            -t ${IMAGE_NAME}:${IMAGE_TAG} \
            -t ${IMAGE_NAME}:latest \
            .
          # Persist the image as a portable artifact and record its digest.
          docker image inspect ${IMAGE_NAME}:${IMAGE_TAG} --format '{{json .Id}}' > ${ARTIFACT_DIR}/image-id.txt
          docker save ${IMAGE_NAME}:${IMAGE_TAG} | gzip > ${ARTIFACT_DIR}/${IMAGE_NAME}-${IMAGE_TAG}.tar.gz
        '''
      }
      post {
        success {
          archiveArtifacts artifacts: "${ARTIFACT_DIR}/${IMAGE_NAME}-*.tar.gz, ${ARTIFACT_DIR}/image-id.txt",
            fingerprint: true, onlyIfSuccessful: true
        }
      }
    }

    // ------------------------------------------------------------------
    // 2. TEST — run the Jest/Supertest suite with hard pass/fail gating
    // ------------------------------------------------------------------
    stage('Test') {
      steps {
        echo '== Test: installing deps and running unit + integration tests =='
        sh '''
          set -euo pipefail
          npm ci
          npm run lint
          # Non-zero exit here fails the stage and stops the pipeline.
          npm run test:coverage
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: 'coverage/lcov.info', allowEmptyArchive: true
        }
      }
    }

    // ------------------------------------------------------------------
    // 3. CODE QUALITY — SonarQube static analysis + quality gate
    // ------------------------------------------------------------------
    stage('Code Quality') {
      steps {
        echo '== Code Quality: SonarQube analysis =='
        // The analysis MUST run inside withSonarQubeEnv so the SonarQube Scanner
        // plugin records the report-task.txt (the analysis task id). Without it,
        // the later waitForQualityGate step fails with "No previous SonarQube
        // analysis found on this pipeline execution".
        //
        // withSonarQubeEnv('SonarQube') injects, from the Jenkins "SonarQube"
        // server config (which references the 'sonar-token' credential):
        //   SONAR_HOST_URL   - the server URL
        //   SONAR_AUTH_TOKEN - the auth token from the sonar-token credential
        // The SONAR_HOST_URL build parameter should match that server URL; we
        // echo it so the expected value is visible in the build log.
        withSonarQubeEnv('SonarQube') {
          sh '''
            set -euo pipefail
            echo "Configured SONAR_HOST_URL parameter: ${SONAR_HOST_URL}"
            sonar-scanner \
              -Dsonar.host.url=${SONAR_HOST_URL} \
              -Dsonar.token=${SONAR_AUTH_TOKEN} \
              -Dsonar.projectVersion=${APP_VERSION}
          '''
        }
      }
    }

    stage('Quality Gate') {
      when { expression { return params.RUN_QUALITY_GATE } }
      steps {
        echo '== Waiting for SonarQube quality gate result =='
        // Fails loudly if the gate is red; needs a Sonar webhook -> Jenkins.
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    // ------------------------------------------------------------------
    // 4. SECURITY — Trivy image scan + dependency (filesystem) scan
    // ------------------------------------------------------------------
    stage('Security') {
      steps {
        echo '== Security: Trivy image + dependency scanning =='
        sh '''
          set -euo pipefail

          # Human-readable report (never fails the build) — full HIGH/CRITICAL view.
          trivy image --severity HIGH,CRITICAL --no-progress \
            --format table ${IMAGE_NAME}:${IMAGE_TAG} | tee ${ARTIFACT_DIR}/trivy-image.txt

          # Dependency / lockfile vulnerability scan of the source tree.
          trivy fs --scanners vuln --severity HIGH,CRITICAL --no-progress \
            --format table . | tee ${ARTIFACT_DIR}/trivy-fs.txt

          # GATE: fail the build on CRITICAL image vulns not explicitly accepted
          # in .trivyignore (documented, justified exceptions).
          trivy image --severity CRITICAL --ignorefile .trivyignore \
            --exit-code 1 --no-progress ${IMAGE_NAME}:${IMAGE_TAG}
        '''
      }
      post {
        always {
          archiveArtifacts artifacts: "${ARTIFACT_DIR}/trivy-*.txt", allowEmptyArchive: true
        }
      }
    }

    // ------------------------------------------------------------------
    // 5. DEPLOY — bring the image up in a staging env via docker-compose
    //    and verify it actually serves traffic before continuing.
    // ------------------------------------------------------------------
    stage('Deploy (Staging)') {
      steps {
        echo '== Deploy: docker-compose to staging + health verification =='
        withCredentials([string(credentialsId: 'taskflow-api-key', variable: 'API_KEY')]) {
          sh '''
            set -euo pipefail
            export IMAGE_TAG=${IMAGE_TAG}
            export APP_VERSION=${APP_VERSION}
            export API_KEY=${API_KEY}

            docker compose up -d --build

            # Poll the health endpoint; fail loudly if it never becomes healthy.
            echo "Waiting for staging health check at ${APP_URL}/health ..."
            for i in $(seq 1 20); do
              if curl -fsS ${APP_URL}/health > /dev/null 2>&1; then
                echo "Staging is healthy."
                exit 0
              fi
              echo "  attempt $i: not ready yet..."; sleep 3
            done
            echo "ERROR: staging never became healthy — dumping logs" >&2
            docker compose logs --tail=100 taskflow-api >&2
            exit 1
          '''
        }
      }
    }

    // ------------------------------------------------------------------
    // 6. RELEASE — promote the exact tested image to a versioned release
    // ------------------------------------------------------------------
    stage('Release') {
      steps {
        echo '== Release: promoting image to a versioned/stable release =='
        sh '''
          set -euo pipefail

          # Retag the same, already-tested image — no rebuild, so the released
          # bits are byte-identical to what passed Test/Security.
          docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:${APP_VERSION}
          docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:release-latest

          # If a registry is reachable, push the release tags there.
          if curl -fsS ${REGISTRY}/v2/ > /dev/null 2>&1; then
            docker tag ${IMAGE_NAME}:${APP_VERSION} ${REGISTRY}/${IMAGE_NAME}:${APP_VERSION}
            docker push ${REGISTRY}/${IMAGE_NAME}:${APP_VERSION}
            echo "Pushed ${REGISTRY}/${IMAGE_NAME}:${APP_VERSION}"
          else
            echo "No registry at ${REGISTRY}; keeping release tags local (documented in SETUP.md)."
          fi

          # Emit release notes as a build artifact.
          {
            echo "Release: ${IMAGE_NAME} ${APP_VERSION}"
            echo "Commit:  ${GIT_SHA}"
            echo "Image:   ${IMAGE_NAME}:${IMAGE_TAG}"
            echo "Date:    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
          } > ${ARTIFACT_DIR}/RELEASE-${APP_VERSION}.txt
        '''
        // Create an annotated, versioned git tag for the release.
        // The Jenkins container has no git identity, so 'git tag -a' would fail
        // with "Committer identity unknown". We set an identity inline and
        // honestly distinguish three outcomes: created / already-exists / failed.
        script {
          def tag = "v${env.APP_VERSION}"
          // Sentinel exit code 42 == "tag already exists" (a non-error skip).
          def rc = sh(returnStatus: true, script: """
            set -eu
            if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null 2>&1; then
              echo "Git tag ${tag} already exists — leaving it untouched."
              exit 42
            fi
            git -c user.email='jenkins@taskflow.ci' -c user.name='TaskFlow CI' \\
                tag -a "${tag}" -m "Automated release ${tag} (${env.GIT_SHA})"
            echo "Created annotated git tag ${tag}."
          """)
          if (rc == 0) {
            echo "Tagged release ${tag}."
          } else if (rc == 42) {
            echo "Release tag ${tag} was already present; not re-created."
          } else {
            error "Release stage FAILED: could not create git tag ${tag} (git exit code ${rc})."
          }

          // Optionally publish the tag to GitHub. Off by default so a missing
          // GitHub credential never blocks a green run; when on, it fails loudly
          // if the push does not succeed.
          if (params.PUSH_GIT_TAG) {
            withCredentials([usernamePassword(credentialsId: 'github-token',
                usernameVariable: 'GIT_USER', passwordVariable: 'GIT_TOKEN')]) {
              sh '''
                set -eu
                # One-shot credential helper feeds the token to git over HTTPS
                # without rewriting the origin URL. Jenkins masks the token in logs.
                git -c credential.helper='!f() { echo "username=${GIT_USER}"; echo "password=${GIT_TOKEN}"; }; f' \\
                    push origin "v${APP_VERSION}"
                echo "Pushed tag v${APP_VERSION} to origin — visible on GitHub."
              '''
            }
          } else {
            echo "PUSH_GIT_TAG=false: tag ${tag} kept local. Enable PUSH_GIT_TAG " +
                 "(needs a 'github-token' credential) to publish it to GitHub."
          }
        }
      }
      post {
        success {
          archiveArtifacts artifacts: "${ARTIFACT_DIR}/RELEASE-*.txt", fingerprint: true
        }
      }
    }

    // ------------------------------------------------------------------
    // 7. MONITORING — confirm Prometheus is scraping the app and that the
    //    alert rules are loaded (fails loudly if monitoring is broken).
    // ------------------------------------------------------------------
    stage('Monitoring') {
      steps {
        echo '== Monitoring: verifying Prometheus scrape target + alert rules =='
        sh '''
          set -euo pipefail

          # 1) The app must be exposing metrics.
          curl -fsS ${APP_URL}/metrics | grep -q http_requests_total \
            || { echo "ERROR: /metrics not exposing expected series" >&2; exit 1; }

          # 2) Prometheus must report the app target as UP.
          echo "Querying Prometheus for scrape target health..."
          for i in $(seq 1 15); do
            UP=$(curl -fsS "${PROMETHEUS_URL}/api/v1/query?query=up%7Bjob%3D%22taskflow-api%22%7D" \
                  | grep -o '"value":\\[[^]]*\\]' | grep -o '"1"' || true)
            if [ -n "$UP" ]; then
              echo "Prometheus reports taskflow-api target UP."; break
            fi
            echo "  attempt $i: target not up yet..."; sleep 4
            if [ "$i" = "15" ]; then
              echo "ERROR: Prometheus never reported taskflow-api as up" >&2; exit 1
            fi
          done

          # 3) The alert rules must be loaded (monitoring is actionable, not decorative).
          curl -fsS "${PROMETHEUS_URL}/api/v1/rules" | grep -q "TaskFlowApiDown" \
            || { echo "ERROR: alert rules not loaded in Prometheus" >&2; exit 1; }
          echo "Alert rules loaded. Monitoring stage verified."
        '''
      }
    }
  }

  post {
    success {
      echo "PIPELINE GREEN ✅  ${IMAGE_NAME}:${IMAGE_TAG} built, tested, scanned, deployed, released, monitored."
    }
    failure {
      echo "PIPELINE FAILED ❌  Check the stage logs above for the loud error."
    }
    always {
      // Keep staging running for the demo; uncomment to tear down automatically.
      // sh 'docker compose down || true'
      archiveArtifacts artifacts: "${ARTIFACT_DIR}/**", allowEmptyArchive: true
    }
  }
}
