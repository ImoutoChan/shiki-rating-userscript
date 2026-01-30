// ==UserScript==
// @name         Shiki Rating
// @namespace    http://shikimori.org/
// @version      2.9.0
// @description  Rating from shiki users
// @author       ImoutoChan
// @match        http://shikimori.org/*
// @match        https://shikimori.org/*
// @match        http://shikimori.one/*
// @match        https://shikimori.one/*
// @match        http://shikimori.me/*
// @match        https://shikimori.me/*
// @match        https://shiki.one/*
// @downloadURL  https://github.com/ImoutoChan/shiki-rating-userscript/raw/master/ShikiRating.user.js
// @updateURL    https://github.com/ImoutoChan/shiki-rating-userscript/raw/master/ShikiRating.user.js
// @license      MIT
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = false;

    const STYLE_ID = 'shiki-rating-style';
    const MAL_RATE_ID = 'mal-score';
    const SHIKI_RATE_ID = 'shiki-score';
    const MAL_LABEL_ID = 'mal-score-label';
    const SHIKI_LABEL_ID = 'shiki-score-label';

    const MAX_RETRIES = 12;
    const RETRY_DELAY_MS = 250;

    let lastPathname = '';
    let retryCount = 0;
    let retryTimer = null;

    function log(...args) {
        if (!DEBUG) {
            return;
        }
        // eslint-disable-next-line no-console
        console.log('ShikiRating:', ...args);
    }

    function getLocale() {
        return document.body?.getAttribute('data-locale') || 'en';
    }

    function isSupportedPage(pathname) {
        return pathname.startsWith('/animes') || pathname.startsWith('/mangas') || pathname.startsWith('/ranobe');
    }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${MAL_LABEL_ID},
            #${SHIKI_LABEL_ID} {
                text-align: center;
                color: #7b8084;
            }
            #${MAL_LABEL_ID} { margin-bottom: 15px; }
            #${SHIKI_RATE_ID}.shiki-no-data {
                text-align: center;
                color: #7b8084;
                margin-top: 15px;
            }
            #${SHIKI_RATE_ID}.shiki-no-data .b-nothing_here { margin: 0; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function clampInt(value, min, max) {
        const num = Number(value);
        if (!Number.isFinite(num)) {
            return min;
        }
        return Math.max(min, Math.min(max, Math.trunc(num)));
    }

    function removeScoreClasses(domElement) {
        if (!domElement || !domElement.classList) {
            return;
        }
        for (const className of Array.from(domElement.classList)) {
            if (/^score-\d+$/.test(className)) {
                domElement.classList.remove(className);
            }
        }
    }

    function setNoData(rateElement) {
        const noData = document.createElement('p');
        noData.classList.add('b-nothing_here');
        noData.textContent = getLocale() === 'ru' ? 'Недостаточно данных' : 'Insufficient data';

        rateElement.classList.add('shiki-no-data');
        rateElement.innerHTML = '';
        rateElement.appendChild(noData);
    }

    function ensureLabels(malRateElement, shikiRateElement, totalCount) {
        const locale = getLocale();

        const malLabelText = locale === 'ru' ? 'На основе оценок mal' : 'From MAL users';
        let malLabel = document.getElementById(MAL_LABEL_ID);
        if (!malLabel) {
            malLabel = document.createElement('p');
            malLabel.id = MAL_LABEL_ID;
            malLabel.className = 'score-source';
        }
        malLabel.textContent = malLabelText;
        if (malLabel.previousElementSibling !== malRateElement) {
            malRateElement.insertAdjacentElement('afterend', malLabel);
        }

        let shikiLabel = document.getElementById(SHIKI_LABEL_ID);
        if (!shikiLabel) {
            shikiLabel = document.createElement('p');
            shikiLabel.id = SHIKI_LABEL_ID;
            shikiLabel.className = 'score-counter';
        }
        const strong = document.createElement('strong');
        strong.textContent = String(totalCount);
        shikiLabel.textContent = '';
        if (locale === 'ru') {
            shikiLabel.append('На основе ', strong, ' оценок shiki');
        } else {
            shikiLabel.append('From ', strong, ' shiki users');
        }
        if (shikiLabel.previousElementSibling !== shikiRateElement) {
            shikiRateElement.insertAdjacentElement('afterend', shikiLabel);
        }
    }

    function readScoreStats() {
        const statsElement = document.querySelector('#rates_scores_stats');
        if (!statsElement) {
            return { state: 'missing' };
        }

        const raw = statsElement.getAttribute('data-stats');
        if (raw == null || raw === '') {
            return { state: 'missing' };
        }

        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return { state: 'invalid' };
            }
            if (parsed.length === 0) {
                return { state: 'empty', data: [] };
            }

            const cleaned = [];
            for (const item of parsed) {
                if (!Array.isArray(item) || item.length < 2) {
                    continue;
                }
                const score = Number(item[0]);
                const count = Number(item[1]);
                if (!Number.isFinite(score) || !Number.isFinite(count)) {
                    continue;
                }
                cleaned.push([score, count]);
            }

            return { state: 'ok', data: cleaned };
        } catch (error) {
            log('Failed to parse data-stats JSON', error);
            return { state: 'invalid' };
        }
    }

    function computeAverageScore(stats) {
        let sumScore = 0;
        let totalCount = 0;

        for (const [score, count] of stats) {
            if (count <= 0) {
                continue;
            }
            sumScore += score * count;
            totalCount += count;
        }

        if (totalCount <= 0) {
            return null;
        }

        return {
            average: sumScore / totalCount,
            totalCount,
        };
    }

    function ensureShikiRateElement(malRateElement) {
        let shikiRateElement = document.getElementById(SHIKI_RATE_ID);
        if (shikiRateElement) {
            return shikiRateElement;
        }

        shikiRateElement = malRateElement.cloneNode(true);
        shikiRateElement.id = SHIKI_RATE_ID;
        malRateElement.parentElement?.appendChild(shikiRateElement);
        return shikiRateElement;
    }

    function maybeScheduleRetry() {
        if (retryCount >= MAX_RETRIES) {
            return;
        }
        if (retryTimer) {
            return;
        }

        retryCount += 1;
        retryTimer = window.setTimeout(() => {
            retryTimer = null;
            appendShikiRating();
        }, RETRY_DELAY_MS);
    }

    function appendShikiRating() {
        const pathname = window.location.pathname;

        if (pathname !== lastPathname) {
            lastPathname = pathname;
            retryCount = 0;
            if (retryTimer) {
                window.clearTimeout(retryTimer);
                retryTimer = null;
            }
        }

        if (!isSupportedPage(pathname)) {
            return;
        }

        ensureStyle();

        const rateContainer = document.querySelector('.scores');
        if (!rateContainer) {
            log("can't find .scores container");
            return;
        }

        const malRateElement = rateContainer.querySelector(':scope > .b-rate') || document.querySelector('.scores > .b-rate');
        if (!malRateElement) {
            log("can't find default rating");
            return;
        }

        malRateElement.id = MAL_RATE_ID;

        let shikiRateElement = ensureShikiRateElement(malRateElement);

        const statsResult = readScoreStats();
        if (statsResult.state === 'missing' || statsResult.state === 'invalid') {
            maybeScheduleRetry();
            return;
        }

        if (statsResult.state === 'empty' || !statsResult.data || statsResult.data.length === 0) {
            setNoData(shikiRateElement);
            return;
        }

        const computed = computeAverageScore(statsResult.data);
        if (!computed) {
            setNoData(shikiRateElement);
            return;
        }

        const { average, totalCount } = computed;
        const digit = clampInt(Math.round(average), 0, 10);
        const locale = getLocale();

        // If the element was previously replaced with a "no data" placeholder, rebuild it from template.
        if (shikiRateElement.classList.contains('shiki-no-data')) {
            const fresh = malRateElement.cloneNode(true);
            fresh.id = SHIKI_RATE_ID;
            shikiRateElement.replaceWith(fresh);
            shikiRateElement = fresh;
        }

        const scoreElement = shikiRateElement.querySelector('div.text-score > div.score-value');
        if (scoreElement) {
            scoreElement.textContent = average.toFixed(2);
            removeScoreClasses(scoreElement);
            scoreElement.classList.add(`score-${digit}`);
        }

        const starElement = shikiRateElement.querySelector('div.stars-container > div.stars.score');
        if (starElement) {
            removeScoreClasses(starElement);
            starElement.classList.add(`score-${digit}`);
            starElement.style.color = '#456';
        }

        const labelData = locale === 'ru'
            ? { 0: '', 1: 'Хуже некуда', 2: 'Ужасно', 3: 'Очень плохо', 4: 'Плохо', 5: 'Более-менее', 6: 'Нормально', 7: 'Хорошо', 8: 'Отлично', 9: 'Великолепно', 10: 'Эпик вин!' }
            : { 0: '', 1: 'Worst Ever', 2: 'Terrible', 3: 'Very Bad', 4: 'Bad', 5: 'So-so', 6: 'Fine', 7: 'Good', 8: 'Excellent', 9: 'Great', 10: 'Masterpiece!' };

        const noticeElement = shikiRateElement.querySelector('div.text-score > div.score-notice');
        if (noticeElement) {
            noticeElement.textContent = labelData[digit] ?? '';
        }

        ensureLabels(malRateElement, shikiRateElement, totalCount);
    }

    function ready(fn) {
        document.addEventListener('page:load', fn);
        document.addEventListener('turbolinks:load', fn);
        document.addEventListener('DOMContentLoaded', fn);

        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            fn();
        }
    }

    ready(appendShikiRating);
})();
