/**
 * Event Emitter
 * @author Electroteque Media Daniel Rossi <danielr@electroteque.org>
 * Copyright (c) 2016 Electroteque Media
 */

//import _Map from "babel-runtime/core-js/map";
//import 'babel-polyfill';

/**
 * Creates a new instance of Emitter.
 * @class
 * @returns {Object} emitter - An instance of Emitter.
 * @example
 * var emitter = new Emitter();
 */

const objectToEvents = new WeakMap();

export default class EventEmitter {

    constructor() {
        objectToEvents.set(this, {});
    }

    /**
     * Adds a listener to the collection for a specified event.
     * @public
     * @function
     * @name Emitter#on
     * @param {String} event - Event name.
     * @param {Function} listener - Listener function.
     * @returns {Object} emitter
     * @example
     * emitter.on('ready', listener);
     */
    on(type, callback) {

        const events = objectToEvents.get(this);

        if (!events[type]) {
            events[type] = [];
        }
        events[type].push(callback);

        return this;
    }

    /**
     * Adds a one time listener to the collection for a specified event. It will execute only once.
     * @public
     * @function
     * @name Emitter#once
     * @param {String} event - Event name.
     * @param {Function} listener - Listener function.
     * @returns {Object} emitter
     * @example
     * me.once('contentLoad', listener);
     */
    once(type, callback) {

        const fn = (...args) => {
            this.off(type, fn);
            callback(...args);
        };

        this.on(type, fn);

        return this;
    }

    /**
     * Removes a listener from the collection for a specified event.
     * @public
     * @function
     * @name Emitter#off
     * @param {String} event - Event name.
     * @param {Function} listener -  Listener function.
     * @returns {Object} emitter
     * @example
     * me.off('ready', listener);
     */
    off(type, callback) {

        const events = objectToEvents.get(this)[type];

        if (events) {
            if (callback === null) {
                events.length = 0;
            } else {
                events.splice(events.indexOf(callback), 1);
            }
        }


        /*let index = 0;

        function isFunction(obj) {
            return typeof obj === 'function' || false;
        }

        if (listeners && listeners.length) {

            index = listeners.reduce((lastIndex, listener, currentIndex) => {
                return isFunction(listener) && listener === callback ? lastIndex = currentIndex : lastIndex;
            }, -1);


            if (index > -1) {
                listeners.splice(index, 1);
                this.listeners.set(event, listeners);
            }
        }*/
        return this;
    }

    /**
     * Returns all listeners from the collection for a specified event.
     * @public
     * @function
     * @name Emitter#listeners
     * @param {String} event - Event name.
     * @returns {Array}
     * @example
     * me.listeners('ready');
     */
    listeners(type) {
        try {
            return objectToEvents.get(this)[type];
        } catch (error) {
            return null;
        }
    }

    /**
     * Execute each item in the listener collection in order with the specified data.
     * @name Emitter#emit
     * @public
     * @function
     * @param {String} event - The name of the event you want to emit.
     * @param {...args} [args] - Data to pass to the listeners.
     * @example
     * me.emit('ready', 'param1', {..}, [...]);
     */
    emit(type, ...args) {

        //const event, events;

        //events = (objectToEvents.get(this)[type] || []).slice();

        const events = objectToEvents.get(this)[type];

        if (events && events.length) {
            events.forEach((listener) => {
                listener({ type: type, target: this}, ...args);
            });
            return true;
        }

        return this;
    }

    emitAsync(type, ...args) {
        //const listeners = this.listeners.get(event),
        const events = objectToEvents.get(this)[type],
            promises = [];


        if (events && events.length) {
            events.forEach((listener) => {
                promises.push(listener({ type: type, target: this}, ...args));
            });
        }

        return Promise.all(promises);
    }

}