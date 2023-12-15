# syntax=docker.io/docker/dockerfile:1.4
ARG SUNODO_SDK_VERSION=0.2.0
ARG MACHINE_EMULATOR_TOOLS_VERSION=0.12.0

FROM --platform=linux/riscv64 riv/toolchain:devel as riv-toolchain

FROM sunodo/${SUNODO_SDK_VERSION} as sunodo-riv

COPY --from=riv-toolchain /root/linux.bin /usr/share/cartesi-machine/images/linux.bin


FROM --platform=linux/riscv64 cartesi/python:3.10-slim-jammy as base

ARG SUNODO_SDK_VERSION
ARG MACHINE_EMULATOR_TOOLS_VERSION

LABEL io.sunodo.sdk_version=${SUNODO_SDK_VERSION}
LABEL io.cartesi.rollups.ram_size=512Mi
LABEL io.cartesi.rollups.data_size=32Mb

RUN <<EOF
apt-get update
apt-get install -y --no-install-recommends busybox-static=1:1.30.1-7ubuntu3 ca-certificates=20230311ubuntu0.22.04.1 curl=7.81.0-1ubuntu1.14 \
    build-essential=12.9ubuntu3 python3-numpy=1:1.21.5-1ubuntu22.04.1 sqlite3=3.37.2-2ubuntu0.1
curl -fsSL https://github.com/cartesi/machine-emulator-tools/releases/download/v${MACHINE_EMULATOR_TOOLS_VERSION}/machine-emulator-tools-v${MACHINE_EMULATOR_TOOLS_VERSION}.tar.gz \
  | tar -C / --overwrite -xvzf -
rm -rf /var/lib/apt/lists/*
EOF

ENV PATH="/opt/cartesi/bin:${PATH}"
ENV PYTHONPATH="/opt/venv/lib/python3.10/site-packages:/usr/lib/python3/dist-packages"

WORKDIR /opt/cartesi/dapp

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip3 install -r requirements.txt --no-cache

RUN apt remove -y build-essential curl git && apt -y autoremove

RUN rm requirements.txt \
    && find /usr/local/lib -type d -name __pycache__ -exec rm -r {} + \
    && find /var/log \( -name '*.log' -o -name '*.log.*' \) -exec truncate -s 0 {} \;

# Main Cartesi App
FROM base as cartesi-app

COPY ./dapp.py .

ENV ROLLUP_HTTP_SERVER_URL="http://127.0.0.1:5004"

RUN <<EOF
echo "#!/bin/sh

set -e

export PYTHONPATH=${PYTHONPATH}
python3 dapp.py
" > entrypoint.sh
chmod +x entrypoint.sh
EOF

ENTRYPOINT ["rollup-init"]
CMD ["/opt/cartesi/dapp/entrypoint.sh"]
