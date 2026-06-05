let ioInstance = null;

const setIoInstance = (io) => {
  ioInstance = io;
};

const getIoInstance = () => ioInstance;

module.exports = { setIoInstance, getIoInstance };
