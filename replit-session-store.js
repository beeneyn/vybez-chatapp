const { Store } = require('express-session');
const Database = require('@replit/database');

class ReplitDBStore extends Store {
    constructor(options = {}) {
        super(options);
        this.db = new Database();
        this.prefix = options.prefix || 'session:';
        this.ttl = options.ttl || 86400;
    }

    async get(sid, callback) {
        try {
            const key = this.prefix + sid;
            const data = await this.db.get(key);
            
            if (!data) {
                return callback(null, null);
            }
            
            if (data.expires && Date.now() > data.expires) {
                await this.destroy(sid, callback);
                return callback(null, null);
            }
            
            callback(null, data.session);
        } catch (err) {
            callback(err);
        }
    }

    async set(sid, session, callback) {
        try {
            const key = this.prefix + sid;
            const expires = Date.now() + (this.ttl * 1000);
            
            await this.db.set(key, {
                session: session,
                expires: expires
            });
            
            callback && callback(null);
        } catch (err) {
            callback && callback(err);
        }
    }

    async destroy(sid, callback) {
        try {
            const key = this.prefix + sid;
            await this.db.delete(key);
            callback && callback(null);
        } catch (err) {
            callback && callback(err);
        }
    }

    async touch(sid, session, callback) {
        try {
            const key = this.prefix + sid;
            const data = await this.db.get(key);
            
            if (data) {
                data.expires = Date.now() + (this.ttl * 1000);
                await this.db.set(key, data);
            }
            
            callback && callback(null);
        } catch (err) {
            callback && callback(err);
        }
    }

    async all(callback) {
        try {
            const keys = await this.db.list(this.prefix);
            const sessions = [];
            
            for (const key of keys) {
                const data = await this.db.get(key);
                if (data && (!data.expires || Date.now() <= data.expires)) {
                    sessions.push(data.session);
                }
            }
            
            callback && callback(null, sessions);
        } catch (err) {
            callback && callback(err);
        }
    }

    async length(callback) {
        try {
            const keys = await this.db.list(this.prefix);
            callback && callback(null, keys.length);
        } catch (err) {
            callback && callback(err);
        }
    }

    async clear(callback) {
        try {
            const keys = await this.db.list(this.prefix);
            
            for (const key of keys) {
                await this.db.delete(key);
            }
            
            callback && callback(null);
        } catch (err) {
            callback && callback(err);
        }
    }
}

module.exports = ReplitDBStore;
