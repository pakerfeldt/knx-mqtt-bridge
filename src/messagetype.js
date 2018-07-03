exports.parse = function(type, logger) {
    if (type === 'convert') {
        return 0;
    } else if (type === 'raw') {
        return 1;
    } else if (type === 'full') {
        return 2;
    } else {
        logger.warn('Unknown message type %s. Using \'convert\'', type);
        return 0;
    }
}
