# Custom Jenkins controller image with everything the pipeline needs on PATH:
# docker CLI + compose plugin, Node 20, Trivy, sonar-scanner, curl, git.
# Running the tools directly on the agent avoids nested-Docker volume-mount
# path problems on WSL2. Build + run instructions are in ../SETUP.md.
FROM jenkins/jenkins:lts-jdk17

USER root

ARG NODE_MAJOR=20
ARG TRIVY_VERSION=0.72.0
ARG SONAR_SCANNER_VERSION=6.2.1.4610

# Base tooling: docker CLI, compose plugin, curl, git, unzip, jq.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg lsb-release unzip git jq \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg \
       | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
  && chmod a+r /etc/apt/keyrings/docker.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
       https://download.docker.com/linux/debian $(lsb_release -cs) stable" \
       > /etc/apt/sources.list.d/docker.list \
  && apt-get update && apt-get install -y --no-install-recommends \
       docker-ce-cli docker-compose-plugin \
  && rm -rf /var/lib/apt/lists/*

# Node.js 20 (for npm ci / test / lint).
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# Trivy (image + dependency scanning) — installed via the official install
# script, which auto-detects arch and verifies the download's SHA-256 checksum.
# This is more robust than pinning a single-arch tarball URL. Version is pinned
# for reproducibility (v0.72.0 verified to exist on the aquasecurity/trivy repo).
RUN curl -sfL "https://raw.githubusercontent.com/aquasecurity/trivy/v${TRIVY_VERSION}/contrib/install.sh" \
      | sh -s -- -b /usr/local/bin "v${TRIVY_VERSION}" \
  && trivy --version

# SonarScanner CLI (code quality analysis).
RUN curl -fsSL "https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SONAR_SCANNER_VERSION}-linux-x64.zip" \
      -o /tmp/sonar.zip \
  && unzip -q /tmp/sonar.zip -d /opt \
  && ln -s /opt/sonar-scanner-${SONAR_SCANNER_VERSION}-linux-x64/bin/sonar-scanner /usr/local/bin/sonar-scanner \
  && rm /tmp/sonar.zip \
  && sonar-scanner --version || true

# Add the jenkins user to the docker group so it can talk to the mounted socket.
# GID 999 is the common host docker group id; override with --build-arg if different.
ARG DOCKER_GID=999
RUN groupadd -g ${DOCKER_GID} docker || groupmod -g ${DOCKER_GID} docker || true \
  && usermod -aG docker jenkins

USER jenkins

# Pre-install the plugins the pipeline relies on.
RUN jenkins-plugin-cli --plugins \
      workflow-aggregator \
      git \
      docker-workflow \
      credentials-binding \
      sonar \
      timestamper \
      ws-cleanup
