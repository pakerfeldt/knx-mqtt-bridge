exports.parse = function(type, logger) {
    if (type === 'value-only') {
        return 0;
    } else if (type === 'full') {
        return 1;
    } else {
        logger.warn('Unknown message type %s. Using \'value-only\'', type);
        return 0;
    }
}
