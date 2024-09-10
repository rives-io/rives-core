# syntax=docker.io/docker/dockerfile:1.4
ARG CARTESI_SDK_VERSION=0.9.0
ARG CARTESI_SDK_RIV_VERSION=0.6.2-riv
ARG MACHINE_EMULATOR_TOOLS_VERSION=0.14.1
ARG OPERATOR_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
ARG KERNEL_VERSION=0.19.1-riv1
ARG RIV_VERSION=0.3-rc16
ARG ROLLUPS_NODE_VERSION=1.5.0
ARG CM_CALLER_VERSION=0.1.6
ARG NONODO_VERSION=1.1.1
ARG RIVES_VERSION=0
ARG DAGSTER_VERSION=1.7.2

FROM debian:11-slim as base-files

COPY core core

# COPY misc/snake.sqfs misc/snake.sqfs
# COPY misc/2048.sqfs misc/2048.sqfs
COPY misc/freedoom.sqfs misc/freedoom.sqfs
# COPY misc/antcopter.sqfs misc/antcopter.sqfs
# COPY misc/monky.sqfs misc/monky.sqfs
# COPY misc/breakout.sqfs misc/breakout.sqfs
# COPY misc/particles.sqfs misc/particles.sqfs
# COPY misc/tetrix.sqfs misc/tetrix.sqfs
COPY misc/test.rivlog misc/test.rivlog


FROM cartesi/sdk:${CARTESI_SDK_VERSION} as cartesi-riv-sdk

ARG KERNEL_VERSION

RUN curl -s -L https://github.com/rives-io/kernel/releases/download/v${KERNEL_VERSION}/linux-6.5.9-ctsi-1-v${KERNEL_VERSION}.bin \
    -o /usr/share/cartesi-machine/images/linux.bin


# make build-release
FROM cartesi/rollups-node:${ROLLUPS_NODE_VERSION} as node

USER root

COPY .cartesi/image_0 /tmp/machine-snapshots/0
COPY .cartesi/image /tmp/machine-snapshots/0_0

ARG NONODO_VERSION
RUN curl -s -L https://github.com/Calindra/nonodo/releases/download/v${NONODO_VERSION}/nonodo-v${NONODO_VERSION}-linux-$(dpkg --print-architecture).tar.gz | \
    tar xzf - -C /usr/local/bin nonodo

ARG CM_CALLER_VERSION
RUN curl -s -L https://github.com/lynoferraz/cm-caller/releases/download/v${CM_CALLER_VERSION}/cm-caller-v${CM_CALLER_VERSION}-linux-$(dpkg --print-architecture).tar.gz | \
    tar xzf - -C /usr/local/bin cm-caller

USER cartesi

# TODO: make deploy here too, but don't do a second deploy for same cm

FROM node as reader-node

USER root

COPY misc/cartesi-machine-v0.16.1_amd64.deb .
RUN dpkg -i cartesi-machine-v0.16.1_amd64.deb
RUN rm cartesi-machine-v0.16.1_amd64.deb

RUN <<EOF
apt-get update && \
apt-get install -y --no-install-recommends python3=3.11.2-1+b1 \
    python3-pip=23.0.1+dfsg-1 python3-venv=3.11.2-1+b1 \
    e2tools=0.1.0-3 squashfs-tools=1:4.5.1-1 nginx=1.22.1-9 \
    git wget
EOF

COPY requirements.txt .

ENV VIRTUAL_ENV=/usr/local
RUN python3 -m venv $VIRTUAL_ENV
RUN pip install -U uv
RUN uv pip install -r requirements.txt --no-cache && rm requirements.txt

ARG RIV_VERSION
RUN curl -s -L https://github.com/rives-io/riv/releases/download/v${RIV_VERSION}/rivemu-linux-$(dpkg --print-architecture) -o /usr/local/bin/rivemu \
    && chmod +x /usr/local/bin/rivemu

RUN apt remove -y python3-pip git && apt -y autoremove
RUN find /usr/local/lib -type d -name __pycache__ -exec rm -r {} + \
    && find /var/log \( -name '*.log' -o -name '*.log.*' \) -exec truncate -s 0 {} \;


RUN <<EOF
echo '
server {
    listen 8080;
    root /var/www;

    location / {
        autoindex   on;
        sendfile    on;
        sendfile_max_chunk  10m;
        tcp_nopush  on;
        tcp_nodelay       on;
        keepalive_timeout 65;
        if ($request_method ~* "(GET|POST)") {
            add_header "Access-Control-Allow-Origin" "*";
        }
        if ($request_method = OPTIONS ) {
            add_header "Access-Control-Allow-Origin"  *;
            add_header "Access-Control-Allow-Methods" "GET, POST, OPTIONS, HEAD";
            add_header "Access-Control-Allow-Headers" "Authorization, Origin, X-Requested-With, Content-Type, Accept";
            return 200;
        }
    }
}
' > /etc/nginx/sites-available/cartridges.conf
rm /etc/nginx/sites-enabled/*
ln -sr /etc/nginx/sites-available/cartridges.conf /etc/nginx/sites-enabled/cartridges.conf
#sed -i 's/www-data/cartesi/' /etc/nginx/nginx.conf
mkdir -p /var/www
usermod -a -G adm cartesi
chmod -R g+w /run
chmod -R g+w /var/lib/nginx
chmod -R g+w /var/log/nginx
chmod -R g+w /var/www
chown -R root:adm /run
chown -R www-data:adm /var/lib/nginx
chown -R www-data:adm /var/log/nginx
chown -R www-data:adm /var/www
EOF

USER cartesi

WORKDIR /opt/cartesi/dapp

COPY --from=base-files misc misc
COPY --from=base-files core core

ENV RIVEMU_PATH=/usr/local/bin/rivemu

ARG RIVES_VERSION
ENV RIVES_VERSION=${RIVES_VERSION}

FROM --platform=linux/riscv64 riv/toolchain:devel as riv-toolchain

WORKDIR /opt/cartesi/dapp

# external verification services
FROM python:3.10-slim as external-verifier-cloud

ARG DAGSTER_VERSION

# Install dependencies
ENV VIRTUAL_ENV=/usr/local
RUN pip install -U uv
RUN uv pip install \
    dagster==${DAGSTER_VERSION} \
    dagster-postgres \
    dagster-aws \
    dagster-k8s \
    dagster-celery[flower,redis,kubernetes] \
    dagster-celery-k8s

RUN <<EOF
apt-get update && \
apt-get install -y --no-install-recommends git wget squashfs-tools && \
rm -rf /var/lib/apt/lists/* /var/log/* /var/cache/*
EOF

WORKDIR /opt/cartesi/dapp_external_verifier

COPY external_verifier/requirements.txt .
RUN uv pip install -r requirements.txt --no-cache && rm requirements.txt

ARG RIV_VERSION
RUN wget -q https://github.com/rives-io/riv/releases/download/v${RIV_VERSION}/rivemu-linux-$(dpkg --print-architecture) -O rivemu \
    && chmod +x rivemu

RUN apt remove -y git wget && apt -y autoremove
RUN find /usr/local/lib -type d -name __pycache__ -exec rm -r {} + \
    && find /var/log \( -name '*.log' -o -name '*.log.*' \) -exec truncate -s 0 {} \;

COPY --from=base-files misc misc
COPY --from=base-files core core

COPY external_verifier/__init__.py external_verifier/__init__.py
COPY external_verifier/common.py external_verifier/common.py
COPY external_verifier/services.py external_verifier/services.py
COPY external_verifier/InputBox.json external_verifier/InputBox.json

RUN <<EOF
echo '[tool.dagster]
module_name = "external_verifier"
' > pyproject.toml
EOF

ENV TEST_TAPE_PATH=../misc/test.rivlog
ENV GENESIS_CARTRIDGES_PATH=../misc
ENV RIVEMU_PATH=../rivemu
ENV INPUT_BOX_ABI_FILE=InputBox.json

ARG RIVES_VERSION
ENV RIVES_VERSION=${RIVES_VERSION}


FROM --platform=linux/riscv64 cartesi/python:3.10-slim-jammy as base

ARG CARTESI_SDK_RIV_VERSION

LABEL io.cartesi.sdk_version=${CARTESI_SDK_RIV_VERSION}
LABEL io.cartesi.rollups.ram_size=128Mi
LABEL io.cartesi.rollups.data_size=32Mb
LABEL io.cartesi.rollups.flashdrive_size=1024Mb

# Install tools
ARG MACHINE_EMULATOR_TOOLS_VERSION
ADD https://github.com/cartesi/machine-emulator-tools/releases/download/v${MACHINE_EMULATOR_TOOLS_VERSION}/machine-emulator-tools-v${MACHINE_EMULATOR_TOOLS_VERSION}.deb /
RUN dpkg -i /machine-emulator-tools-v${MACHINE_EMULATOR_TOOLS_VERSION}.deb \
  && rm /machine-emulator-tools-v${MACHINE_EMULATOR_TOOLS_VERSION}.deb

RUN <<EOF
apt-get update && \
apt-get install -y --no-install-recommends busybox-static=1:1.30.1-7ubuntu3 \
    build-essential=12.9ubuntu3 sqlite3=3.37.2-2ubuntu0.3 git=1:2.34.1-1ubuntu1.11 \
    squashfs-tools=1:4.5-3build1 xdelta3=3.0.11-dfsg-1.2 patch=2.7.6-7build2 && \
rm -rf /var/lib/apt/lists/* /var/log/* /var/cache/* && \
useradd --create-home --user-group dapp
EOF

ENV PATH="/opt/cartesi/bin:${PATH}"

# Install dependencies
COPY requirements.txt .
RUN <<EOF
set -e
pip install -r requirements.txt --no-cache
find /usr/local/lib -type d -name __pycache__ -exec rm -r {} +
EOF

# Install RIVOS
ARG RIV_VERSION
ADD --chmod=644 https://github.com/rives-io/riv/releases/download/v${RIV_VERSION}/rivos.ext2 /rivos.ext2
ADD --chmod=644 https://raw.githubusercontent.com/rives-io/riv/v${RIV_VERSION}/rivos/skel/etc/sysctl.conf /etc/sysctl.conf
ADD --chmod=755 https://raw.githubusercontent.com/rives-io/riv/v${RIV_VERSION}/rivos/skel/usr/sbin/cartesi-init /usr/sbin/cartesi-init
ADD --chmod=755 https://raw.githubusercontent.com/rives-io/riv/v${RIV_VERSION}/rivos/skel/etc/cartesi-init.d/riv-init /etc/cartesi-init.d/riv-init
RUN <<EOF
set -e
mkdir -p /rivos /cartridges
echo 'if [ -f /rivos-$1.ext2 ]; then rivos="/rivos-$1.ext2";' > /usr/sbin/riv-mount
echo 'else rivos="/rivos.ext2"; fi' >> /usr/sbin/riv-mount
echo 'mount -o ro,noatime,nosuid -t ext2 $rivos /rivos' >> /usr/sbin/riv-mount
echo "mount --bind /cartridges /rivos/cartridges" >> /usr/sbin/riv-mount
chmod 755 /usr/sbin/riv-mount
echo "umount /rivos/cartridges" > /usr/sbin/riv-umount
echo "umount /rivos" >> /usr/sbin/riv-umount
chmod 755 /usr/sbin/riv-umount
EOF

# Clean tools
RUN apt remove -y build-essential git && apt -y autoremove
RUN rm requirements.txt \
    && find /usr/local/lib -type d -name __pycache__ -exec rm -r {} + \
    && find /var/log \( -name '*.log' -o -name '*.log.*' \) -exec truncate -s 0 {} \;


# install dapp
WORKDIR /opt/cartesi/dapp

COPY --from=base-files misc misc
COPY --from=base-files core core

ARG OPERATOR_ADDRESS
ENV OPERATOR_ADDRESS=${OPERATOR_ADDRESS}
ENV ROLLUP_HTTP_SERVER_URL="http://127.0.0.1:5004"

FROM base as dapp

RUN <<EOF
echo '#!/bin/bash
while : ; do
	echo "Initializing Dapp"
	rollup-init cartesapp run --log-level info
done
' > entrypoint.sh
chmod +x entrypoint.sh
EOF

ENTRYPOINT ["bash"]
CMD ["entrypoint.sh"]
