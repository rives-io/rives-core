
all: sunodo-riv build

sunodo-riv: sunodo-sdk

sunodo-sdk:
	docker build --tag sunodo/sdk:0.2.0-riv --target sunodo-riv-sdk .

build:
	sunodo build