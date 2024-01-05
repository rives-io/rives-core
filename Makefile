
all: sunodo-riv build

sunodo-riv: sunodo-sdk

sunodo-sdk:
	docker build --tag sunodo/sdk:0.2.0-riv --target sunodo-riv-sdk .

build:
	sunodo build

testimage:
	docker build . --target base -t watest

run-testimage:
	docker run -it --rm --platform=linux/riscv64 watest bash
