# syntax=docker.io/docker/dockerfile:1.4
ARG SUNODO_SDK_VERSION=0.4.0
ARG MACHINE_EMULATOR_TOOLS_VERSION=0.14.1
ARG OPERATOR_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

FROM --platform=linux/riscv64 riv/toolchain:devel as riv-toolchain

FROM --platform=linux/riscv64 cartesi/python:3.10-slim-jammy as base

ARG SUNODO_SDK_VERSION
ARG MACHINE_EMULATOR_TOOLS_VERSION
ARG OPERATOR_ADDRESS

LABEL io.sunodo.sdk_version=${SUNODO_SDK_VERSION}
LABEL io.cartesi.rollups.ram_size=128Mi
LABEL io.cartesi.rollups.data_size=32Mb
LABEL io.cartesi.rollups.flashdrive_size=128Mb

# Install tools
ADD https://github.com/cartesi/machine-emulator-tools/releases/download/v${MACHINE_EMULATOR_TOOLS_VERSION}/machine-emulator-tools-v${MACHINE_EMULATOR_TOOLS_VERSION}.deb /
RUN dpkg -i /machine-emulator-tools-v${MACHINE_EMULATOR_TOOLS_VERSION}.deb \
  && rm /machine-emulator-tools-v${MACHINE_EMULATOR_TOOLS_VERSION}.deb

RUN <<EOF
apt-get update && \
apt-get install -y --no-install-recommends busybox-static=1:1.30.1-7ubuntu3 \
    build-essential=12.9ubuntu3 sqlite3=3.37.2-2ubuntu0.3 git=1:2.34.1-1ubuntu1.10 squashfs-tools=1:4.5-3build1 && \
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

# install riv rootfs
COPY --from=riv-toolchain /rootfs /rivos
RUN cp /rivos/etc/sysctl.conf /etc/sysctl.conf
RUN mkdir -p /rivos/cartridges

# install custom init
COPY --from=riv-toolchain /rootfs/sbin/init /usr/bin/cartesi-init

# install musl libc
RUN ln -s /rivos/lib/ld-musl-riscv64.so.1 /lib/

# install busybox
RUN ln -s /rivos/usr/busybox /usr/bin/busybox

# install riv-chroot
RUN ln -s /rivos/usr/bin/bwrap /usr/bin/ && \
    ln -s /rivos/usr/lib/libcap.so.2 /usr/lib/ && \
    ln -s /rivos/sbin/riv-chroot /sbin/

# Clean tools
RUN apt remove -y build-essential git && apt -y autoremove
RUN rm requirements.txt \
    && find /usr/local/lib -type d -name __pycache__ -exec rm -r {} + \
    && find /var/log \( -name '*.log' -o -name '*.log.*' \) -exec truncate -s 0 {} \;


    # install dapp
WORKDIR /opt/cartesi/dapp

COPY core core

COPY misc/snake.sqfs misc/snake.sqfs
# COPY misc/2048.sqfs misc/2048.sqfs
COPY misc/freedoom.sqfs misc/freedoom.sqfs
COPY misc/antcopter.sqfs misc/antcopter.sqfs
COPY misc/monky.sqfs misc/monky.sqfs
COPY misc/breakout.sqfs misc/breakout.sqfs
COPY misc/test.rivlog misc/test.rivlog

ENV ROLLUP_HTTP_SERVER_URL="http://127.0.0.1:5004"

FROM base as dapp

ENTRYPOINT ["rollup-init"]
CMD ["cartesapp","run","core","--log-level","info"]
