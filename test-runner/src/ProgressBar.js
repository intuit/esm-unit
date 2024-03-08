"use strict";

import assert from "assert";

const COLOR_RESET = "\x1b[0m";
const COLOR_RED = "\x1b[31m";
const COLOR_BOLD_RED = "\x1b[31;1m";
const COLOR_YELLOW = "\x1b[33m";

export default class ProgressBar {

    constructor(options) {
        options = options || {};

        this.ttyEnabled = !!process.stdout.clearLine;

        this.ticksDone = 0;
        this.totalTicks = 1;
        this.label = "";
        this.fillChar = options.fillChar || "="
        this.endChar = options.endChar || options.fillChar || ">";
        this.labelStyle = options.labelStyle || "none";

        assert(typeof this.fillChar == "string" && this.fillChar.length == 1, "fillChar must be a single character");

        this.running = false;

        if (this.ttyEnabled) {
            process.stdout.on('resize', this._refresh.bind(this));
        }
        this._render();
    }

    start(label, totalTicks) {
        if (!this.ttyEnabled) {
            return;
        }
        this.label = label || "";
        this.totalTicks = totalTicks || 0;
        this.ticksDone = 0;
        this.running = true;
        this._render(false);
    }

    end() {
        if (this.running) {
            this._clear();
            this._render(false);
            console.log();
            this.running = false;
        }
    }

    tick() {
        this.ticksDone++;
        this._refresh();
    }

    addTotalTicks(totalTicks) {
        this.totalTicks += totalTicks;
    }

    log() {
        this._log(console.log, arguments);
    }

    error() {
        this._log(console.error, arguments, COLOR_RED);
    }

    boldError() {
        this._log(console.error, arguments, COLOR_BOLD_RED);
    }

    warn() {
        this._log(console.warn, arguments, COLOR_YELLOW);
    }

    _setColor(color) {
        if (this.ttyEnabled) {
            process.stdout.write(color);
        }
    }

    _log(logFunc, args, color) {
        this._clear();
        this._setColor(color || COLOR_RESET);
        logFunc.apply(console, args);
        this._setColor(COLOR_RESET);
        this._render(true);
    }


    _progressText() {
        switch (this.labelStyle) {
            case "ratio":
                return this.ticksDone + "/" + this.totalTicks;
            case "percent":
                var percentDone = this.totalTicks ? (this.ticksDone / this.totalTicks) : 0;
                return Math.floor(percentDone*100)+"%";
            default:
            case "none":
                return "";
        }
    }


    _render(showProgressBar) {
        if (!this.running)
            return;

        var progressText = (this.label ? this.label + " " : "") + this._progressText() + " ";

        if (showProgressBar) {
            var amountDone = this.ticksDone / this.totalTicks;
            if (amountDone < 1) {
                var terminalWidth = process.stdout.columns;
                var progressLength = Math.floor(amountDone * (terminalWidth - progressText.length));

                progressText += Array(progressLength).join(this.fillChar) + this.endChar;
                progressText = progressText.substr(0, terminalWidth);
            }
        }

        process.stdout.write(progressText);
    }


    _clear() {
        if (!this.running) {
            return;
        }
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
    }


    _refresh() {
        this._clear();
        this._render(true);
    }

};
