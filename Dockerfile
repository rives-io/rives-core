# syntax=docker.io/docker/dockerfile:1.4
ARG SUNODO_SDK_VERSION=0.2.0
ARG SUNODORIV_SDK_VERSION=0.2.0-riv
ARG MACHINE_EMULATOR_TOOLS_VERSION=0.12.0


FROM sunodo/sdk:${SUNODO_SDK_VERSION} as sunodo-riv-sdk

COPY --from=riv-toolchain /root/linux.bin /usr/share/cartesi-machine/images/linux.bin


FROM --platform=linux/riscv64 riv/toolchain:devel as riv-toolchain


FROM --platform=linux/riscv64 cartesi/python:3.10-slim-jammy as base

ARG SUNODORIV_SDK_VERSION
ARG MACHINE_EMULATOR_TOOLS_VERSION

LABEL io.sunodo.sdk_version=${SUNODORIV_SDK_VERSION}
LABEL io.cartesi.rollups.ram_size=128Mi
#LABEL io.cartesi.rollups.data_size=32Mb

WORKDIR /opt/tools

# Install tools
RUN <<EOF
apt-get update && \
apt-get install -y --no-install-recommends wget=1.21.2-2ubuntu1 ca-certificates=20230311ubuntu0.22.04.1 \
    build-essential=12.9ubuntu3 sqlite3=3.37.2-2ubuntu0.3 git=1:2.34.1-1ubuntu1.10 && \
wget -O machine-emulator-tools.deb https://github.com/cartesi/machine-emulator-tools/releases/download/v${MACHINE_EMULATOR_TOOLS_VERSION}/machine-emulator-tools-v${MACHINE_EMULATOR_TOOLS_VERSION}.deb && \
rm -rf /var/lib/apt/lists/*
EOF

ENV PATH="/opt/cartesi/bin:${PATH}"
ENV PYTHONPATH="/opt/venv/lib/python3.10/site-packages:/usr/lib/python3/dist-packages"

# Install dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip3 install -r requirements.txt --no-cache

# Clean tools
RUN apt remove -y build-essential git wget && apt -y autoremove
RUN rm requirements.txt \
    && find /usr/local/lib -type d -name __pycache__ -exec rm -r {} + \
    && find /var/log \( -name '*.log' -o -name '*.log.*' \) -exec truncate -s 0 {} \;

# install cartesi tools
RUN dpkg -i machine-emulator-tools.deb && rm -f machine-emulator-tools.deb

# install riv rootfs
COPY --from=riv-toolchain /rootfs /rivos
RUN cp /rivos/etc/sysctl.conf /etc/sysctl.conf
RUN mkdir -p /rivos/cartridges

# install custom init
COPY --from=riv-toolchain /rootfs/sbin/init /opt/cartesi/bin/init

# install musl libc
RUN ln -s /rivos/lib/ld-musl-riscv64.so.1 /lib/

# install busybox
RUN ln -s /rivos/usr/bin/busybox /usr/bin/busybox

# install riv-chroot
RUN ln -s /rivos/usr/bin/bwrap /usr/bin/ && \
    ln -s /rivos/usr/lib/libcap.so.2 /usr/lib/ && \
    ln -s /rivos/sbin/riv-chroot /sbin/

# install dapp
WORKDIR /opt/cartesi/dapp

COPY main.py .
COPY cartesapp cartesapp
COPY app app
COPY misc/snake.sqfs misc/snake.sqfs

FROM base as dapp

RUN <<EOF
echo "#!/bin/sh

set -e

export PYTHONPATH=${PYTHONPATH}
python3 main.py
" > entrypoint.sh && \
chmod +x entrypoint.sh
EOF

ENV ROLLUP_HTTP_SERVER_URL="http://127.0.0.1:5004"

ENTRYPOINT ["rollup-init"]
CMD ["/opt/cartesi/dapp/entrypoint.sh"]
