// ==UserScript==
// @name         Shiki Rating
// @namespace    http://shikimori.org/
// @version      1.1.1
// @description  Rating from shiki users
// @author       ImoutoChan
// @match        http://shikimori.org/*
// @match        https://shikimori.org/*
// @grant        none
// ==/UserScript==

var func = function() {
    'use strict';

    var urlpart = window.location.pathname.substring(0,7);
    if (urlpart == "/animes" || urlpart == "/mangas")
    {
        if ($(".scores > .b-rate").length > 1)
        {
            return;
        }


        var labelEngData = JSON.parse('{"0":"","1":"Worst Ever","2":"Terrible","3":"Very Bad","4":"Bad","5":"So-so","6":"Fine","7":"Good","8":"Excellent","9":"Great","10":"Masterpiece!"}');
        var labelRusData = JSON.parse('{"0":"","1":"Хуже некуда","2":"Ужасно","3":"Очень плохо","4":"Плохо","5":"Более-менее","6":"Нормально","7":"Хорошо","8":"Отлично","9":"Великолепно","10":"Эпик вин!"}');
        var currentLabel = $("div.b-rate > div.text-score > div.score-notice").last().text();
        var useRus = _isContains(labelRusData, currentLabel);


        var newRate = $(".scores > .b-rate").clone();
        newRate.attr('id', 'shiki-score');
        newRate.appendTo(".scores");


        var scoreData = jQuery.parseJSON($("#rates_scores_stats").attr("data-stats"));


        var sumScore = 0;
        var totalCount = 0;
        for (var i = 0; i < scoreData.length; i++)
        {
            sumScore += scoreData[i].value * scoreData[i].name;
            totalCount += scoreData[i].value;
        }

        var shikiScore = sumScore / totalCount;


        for (i = 0; i < 10; i++)
        {
            $("#shiki-score > div.text-score > div.score-value.score-" + i).removeClass("score-" + i);
        }
        $("#shiki-score > div.text-score > div.score-value").html(shikiScore.toFixed(2));
        $("#shiki-score > div.text-score > div.score-value").addClass("score-" + Math.round(shikiScore));

        for (i = 0; i < 10; i++)
        {
            $("#shiki-score > div.stars-container > div.stars.score.score-" + i).removeClass("score-" + i);
        }
        $("#shiki-score > div.stars-container > div.stars.score").attr('style', 'color: #456 !important;');
        $("#shiki-score > div.stars-container > div.stars.score").addClass("score-" + Math.round(shikiScore));


        $("#shiki-score > div.text-score > div.score-notice").text(useRus ? labelRusData[Math.round(shikiScore)] : labelEngData[Math.round(shikiScore)]);
    }
};

function _isContains(json, value) {
    let contains = false;
    Object.keys(json).some(key => {
        contains = typeof json[key] === 'object' ? _isContains(json[key], value) : json[key] === value;
        return contains;
    });
    return contains;
}

$(document).bind('mouseup mousemove ready', function(){
    func();
});

$(document).ready(func);
$(document).on('page:load', func);
$(document).on('turbolinks:load', func);
