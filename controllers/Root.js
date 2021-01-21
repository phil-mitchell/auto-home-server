'use strict';

module.exports = class RootController {
    static async formatResponse( reqContext, value ) {
        return value;
    }
};
