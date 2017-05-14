// ==UserScript==
// @name         Shiki Rating
// @namespace    http://shikimori.org/
// @version      1.0.0
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
        //alert("test!");

        if ($(".scores > .b-rate").length > 1)
        {
            return;
        }

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
    }
};

// $(document).bind('mouseup mousemove ready', function(){
//     func();
// });

$(document).ready(func);
$(document).on('page:load', func);
$(document).on('turbolinks:load', func);
