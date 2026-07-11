# Custom Prometheus image with the scrape config + alert rules baked in.
#
# WHY BAKE INSTEAD OF BIND-MOUNT:
# The pipeline runs `docker compose` from INSIDE the Jenkins container, but the
# Docker daemon runs on the HOST. A bind mount (./prometheus/prometheus.yml) is
# resolved by the daemon against the HOST filesystem, where the Jenkins workspace
# path does not exist — so the daemon auto-creates an empty directory and the
# file mount fails. A build context, however, is read by the docker CLI (inside
# the Jenkins container, where the files DO exist) and streamed to the daemon, so
# baking the config in avoids the path-mismatch entirely and behaves identically
# for a normal `docker compose up --build` on a user's own machine.
FROM prom/prometheus:v2.54.1

# Overwrite the image's default config with ours, and add the alert rules.
# prometheus.yml references /etc/prometheus/alert.rules.yml via rule_files.
COPY prometheus.yml /etc/prometheus/prometheus.yml
COPY alert.rules.yml /etc/prometheus/alert.rules.yml
