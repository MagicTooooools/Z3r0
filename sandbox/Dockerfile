FROM golang:1.26-bookworm AS go-builder

ENV CGO_ENABLED=0

WORKDIR /build/proxy

COPY proxy/go.mod ./
COPY proxy/main.go ./
RUN go build -trimpath -ldflags="-s -w" -o /out/sandbox-proxy .

FROM debian:bookworm-slim AS novnc-assets

ARG DEBIAN_FRONTEND=noninteractive

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends novnc; \
    mkdir -p /out; \
    cp -a /usr/share/novnc /out/novnc; \
    ln -sf vnc.html /out/novnc/index.html; \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/* /tmp/* /var/tmp/*

FROM debian:bookworm-slim

ENV HOME=/root \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    DISPLAY=:0

ARG DEBIAN_FRONTEND=noninteractive

RUN set -eux; \
    printf '%s\n' \
      'path-exclude=/usr/share/doc/*' \
      'path-exclude=/usr/share/man/*' \
      'path-exclude=/usr/share/info/*' \
      'path-exclude=/usr/share/lintian/*' \
      'path-exclude=/usr/share/locale/*' \
      'path-include=/usr/share/locale/locale.alias' \
      > /etc/dpkg/dpkg.cfg.d/01_nodoc; \
    apt-get update; \
    apt-get install -y \
      --no-install-recommends \
      ca-certificates \
      chromium \
      supervisor \
      websockify \
      x11vnc \
      xvfb \
      fonts-droid-fallback; \
    mkdir -p /data; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/* /tmp/* /var/tmp/*

EXPOSE 8000

COPY --from=novnc-assets /out/novnc /usr/share/novnc
COPY --chmod=755 entrypoint.sh /entrypoint.sh
COPY --from=go-builder --chmod=755 /out/sandbox-proxy /usr/local/bin/sandbox-proxy
COPY supervisord.conf /supervisord.conf

ENTRYPOINT [ "/entrypoint.sh" ]
