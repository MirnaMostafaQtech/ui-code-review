/*
    common/dotnet-compat.js

    The scripts were first written in Windows PowerShell 5.1. A few .NET behaviours decide what a
    review produces - above all the hidden fingerprints in comments already posted on PRs, which a
    re-run must reproduce exactly or it posts every comment again. This module reproduces those
    behaviours, so the Node scripts give the same findings, comments and fingerprints:

      - String.Trim() and Char.IsWhiteSpace (trims U+0085, keeps U+FEFF; JavaScript does the reverse)
      - File.ReadAllText / ReadAllLines (byte order mark detection, \r\n, \r and \n line breaks)
      - Uri.EscapeDataString (also escapes ! ' ( ) *)
      - WebUtility.HtmlEncode
      - Sort-Object's culture-aware, case-insensitive string order
      - "$value" string conversion and PowerShell 5.1's lenient ConvertFrom-Json

    Consumers: scripts/*.js, scm-adapters/tfs.js.
*/
'use strict';

const fs = require('fs');
const path = require('path');

// Char.IsWhiteSpace: Unicode Zs/Zl/Zp plus \t \n \v \f \r and U+0085. Not U+FEFF.
const WS = '\\u0009-\\u000D\\u0020\\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000';
const trimStartRe = new RegExp(`^[${WS}]+`);
const trimEndRe = new RegExp(`[${WS}]+$`);

function trim(s) { return trimEnd(trimStart(s)); }
function trimStart(s) { return String(s).replace(trimStartRe, ''); }
function trimEnd(s) { return String(s).replace(trimEndRe, ''); }

// Trims the given characters from both ends, like String.Trim(char[]).
function trimChars(s, chars) {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start])) start++;
    while (end > start && chars.includes(s[end - 1])) end--;
    return s.slice(start, end);
}

// StreamReader with byte order mark detection (File.ReadAllText(path, UTF8) and ReadAllLines).
function decodeText(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return buffer.subarray(3).toString('utf8');
    }
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return buffer.subarray(2).toString('utf16le');
    }
    if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
        const swapped = Buffer.from(buffer.subarray(2));
        swapped.swap16();
        return swapped.toString('utf16le');
    }
    return buffer.toString('utf8');
}

function readAllText(file) {
    return decodeText(fs.readFileSync(file));
}

// File.ReadAllLines: splits on \r\n, \r and \n; a final line break doesn't add an empty line.
function readAllLines(file) {
    const text = readAllText(file);
    if (text === '') return [];
    const lines = text.split(/\r\n|\r|\n/);
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
}

function writeUtf8(file, text) {
    fs.writeFileSync(file, text, { encoding: 'utf8' });
}

// [Text.Encoding]::UTF8.GetString(bytes).TrimStart([char]0xFEFF): no other byte order mark is detected.
function utf8BytesToText(buffer) {
    if (!buffer) return '';
    return buffer.toString('utf8').replace(/^﻿+/, '');
}

function escapeDataString(s) {
    return encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function unescapeDataString(s) {
    try { return decodeURIComponent(s); } catch { return s; }
}

// WebUtility.HtmlEncode: < > & " ' plus U+00A0..U+00FF and characters outside the BMP as &#N;.
function htmlEncode(value) {
    let out = '';
    for (const ch of String(value ?? '')) {
        const code = ch.codePointAt(0);
        switch (ch) {
            case '<': out += '&lt;'; break;
            case '>': out += '&gt;'; break;
            case '&': out += '&amp;'; break;
            case '"': out += '&quot;'; break;
            case "'": out += '&#39;'; break;
            default:
                out += (code >= 0xA0 && code <= 0xFF) || code > 0xFFFF ? `&#${code};` : ch;
        }
    }
    return out;
}

// Join-Path: keeps the parent as given and adds the platform separator.
function joinPath(parent, child) {
    return String(parent).replace(/[\\/]+$/, '') + path.sep + String(child).replace(/^[\\/]+/, '');
}

// Split-Path -Leaf, for both separators.
function leafName(p) {
    const parts = String(p).split(/[\\/]/);
    return parts[parts.length - 1];
}

// "$value" in PowerShell: $null is '', booleans are True/False, arrays are joined with spaces.
function psString(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (Array.isArray(value)) return value.map(psString).join(' ');
    return String(value);
}

// Property access on a ConvertFrom-Json object is case-insensitive.
function getProperty(obj, name) {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, name)) return obj[name];
    const lower = name.toLowerCase();
    const key = Object.keys(obj).find((k) => k.toLowerCase() === lower);
    return key === undefined ? undefined : obj[key];
}

function hasProperty(obj, name) {
    return getProperty(obj, name) !== undefined;
}

/*
    Sort-Object's string order (en-US, case-insensitive), measured against Windows PowerShell 5.1:
    ' and - are ignored except to break a tie (fewer of them first, ' before -), symbols sort before
    digits and digits before letters, in this order. Strings equal apart from case compare equal.
*/
const SYMBOL_ORDER = ' !"#$%&()*,./:;?@[\\]^_`{|}~+<=>';

function charWeight(ch) {
    const symbol = SYMBOL_ORDER.indexOf(ch);
    if (symbol >= 0) return symbol;
    if (ch >= '0' && ch <= '9') return 100 + ch.charCodeAt(0);
    const lower = ch.toLowerCase();
    if (lower >= 'a' && lower <= 'z') return 200 + lower.charCodeAt(0);
    return 1000 + lower.codePointAt(0);
}

function compareCulture(a, b) {
    a = psString(a);
    b = psString(b);
    const x = a.replace(/['-]/g, '');
    const y = b.replace(/['-]/g, '');
    const n = Math.min(x.length, y.length);
    for (let i = 0; i < n; i++) {
        const d = charWeight(x[i]) - charWeight(y[i]);
        if (d !== 0) return d;
    }
    if (x.length !== y.length) return x.length - y.length;
    const ia = a.replace(/[^'-]/g, '');
    const ib = b.replace(/[^'-]/g, '');
    if (ia.length !== ib.length) return ia.length - ib.length;
    return ia < ib ? -1 : ia > ib ? 1 : 0;
}

// Sort-Object with several keys; each key is a function returning a number or a string.
function sortBy(items, ...keys) {
    return [...items].sort((p, q) => {
        for (const key of keys) {
            const a = key(p);
            const b = key(q);
            const d = typeof a === 'number' && typeof b === 'number' ? a - b : compareCulture(a, b);
            if (d !== 0) return d;
        }
        return 0;
    });
}

/*
    ConvertFrom-Json in Windows PowerShell 5.1 also accepts single-quoted strings and unquoted
    property names (not trailing commas or comments). A reply that strict JSON rejects is rewritten
    with those two forms made strict and parsed again. It is never evaluated as code.
*/
function parseJsonLikePowerShell(text) {
    try {
        return JSON.parse(text);
    }
    catch (strictError) {
        try { return JSON.parse(relaxedToStrictJson(text)); }
        catch { throw strictError; }
    }
}

function relaxedToStrictJson(text) {
    let out = '';
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (c === '"' || c === "'") {
            let j = i + 1;
            let body = '';
            while (j < text.length && text[j] !== c) {
                if (text[j] === '\\' && j + 1 < text.length) {
                    // \' is only an escape inside single quotes; strict JSON has no such escape.
                    body += text[j + 1] === "'" ? "'" : text[j] + text[j + 1];
                    j += 2;
                    continue;
                }
                body += c === "'" && text[j] === '"' ? '\\"' : text[j];
                j++;
            }
            out += `"${body}"`;
            i = j + 1;
            continue;
        }
        if (/[A-Za-z_$]/.test(c)) {
            let j = i;
            while (j < text.length && /[\w$]/.test(text[j])) j++;
            const word = text.slice(i, j);
            const isKey = /^\s*:/.test(text.slice(j)) && !['true', 'false', 'null'].includes(word);
            out += isKey ? `"${word}"` : word;
            i = j;
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

// foreach over a ConvertFrom-Json result: an array gives its items, $null gives none, anything else one.
function jsonItems(value) {
    if (value === null || value === undefined) return [];
    return Array.isArray(value) ? value : [value];
}

module.exports = {
    trim, trimStart, trimEnd, trimChars,
    decodeText, readAllText, readAllLines, writeUtf8, utf8BytesToText,
    escapeDataString, unescapeDataString, htmlEncode,
    joinPath, leafName, psString, getProperty, hasProperty,
    compareCulture, sortBy, parseJsonLikePowerShell, jsonItems,
};
