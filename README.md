# World Arcade

```
Cartesi Rollups Node version: 1.2.x (sunodo version 0.10.x)
```

The World Arcade allows users to play riscv-binaries of games on a RISC-v Cartesi Machine on the browser, submit the game moves onchain so the session will be replayed a Cartesi Rollups DApp to generate a provable score. Naturally you can upload you own games.

DISCLAIMERS

For now, this is not a final product and should not be used as one.

## Requirements

- [npm](https://docs.npmjs.com/cli/v9/configuring-npm/install) (To install dependencies and run the frontend)
- [Sunodo](https://github.com/sunodo/sunodo) (To build and run the DApp backend)
- [Metamask](https://metamask.io/) (To sign transactions in the frontend)
- [json-schema-to-typescript](https://www.npmjs.com/package/json-schema-to-typescript) to generate typescript interfaces`npm install -g json-schema-to-typescript --save`

To build the DApp, two images are also required: `riv/toolchain` and `sunodo/sdk:0.2.0-riv`.

- To generate `riv/toolchain`, clone [RIV repository](https://github.com/edubart/riv) and in its directory do:
```shell
make toolchain
```

- To generate `sunodo/sdk:0.2.0-riv`, in the `world-arcade` project directory do:
```shell
docker build --tag sunodo/sdk:0.2.0-riv . --target sunodo-riv --progress plain .
```

## Building

Build with:

```shell
sunodo build
```

## Running

Run the DApp environment with:

```shell
sunodo run
```
