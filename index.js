var EQS = {};

EQS.main = function() {
    var DAMAGE_DESCRIPTIONS = {
        "": "UNKNOWN",
        "1": "LIMITED (<1m USD)",
        "2": "MODERATE (1-5m USD)",
        "3": "SEVERE (5-524m USD)",
        "4": "EXTREME (>525m USD)"
    }
    alasql('CREATE TABLE IF NOT EXISTS quakes; SELECT * INTO quakes from TSV("data/significant_quakes.tsv")');

    var maparea = $(".mapcontainer");
    maparea.mapael({
        map: {
            name: "world_countries",
            zoom: {
                enabled: true,
                maxLevel: 50
            },
            defaultArea: {
                tooltip: {
                    content: function(e) { return $(e.node).attr("data-id"); }
                },
                eventHandlers: {
                    click: function (e, id) {
                        maparea.trigger('zoom', {
                            area: id,
                            areaMargin: 10
                        });
                    }
                }
            }
        }
    });
    noUiSlider.create($('#year_slider').get(0), {
        start: [-10, 9],
        step: 1,
        connect: true,
        tooltips: true,
        range: {
            'min': -2150,
            '50%': [1860, 1],
            'max': 2018
        },
        pips: {
            mode: 'values',
            values: [-2150, -1500, -1000, -500, 0, 500, 
                     1000, 1500, 1850, 1880, 1900, 1920, 1940,
                     1960, 1980, 2000, 2018],
            density: 1000
        }
    });

    function update_damage_values(value, type) {
        value = value == 0 ? "" : value;
        return DAMAGE_DESCRIPTIONS[value];
    }
    noUiSlider.create($('#damage_slider').get(0), {
        start: [3, 4],
        step: 1,
        connect: true,
        range: {
            min: 0,
            max: 4,
        },
        pips: {
            mode: 'steps',
            format: {to: update_damage_values}
        }
    });

    noUiSlider.create($('#deaths_info_slider').get(0), {
        start: [0, 830000],
        step: 1,
        connect: true,
        tooltips: true,
        range: {
            min: 0,
            '50%': [10000, 1],
            max: 830000
        },
        pips: {
            mode: 'values',
            values: [0, 1000, 10000, 100000, 830000],
            density: 1000
        }
    });

    damage_slider.noUiSlider.on('end', recalculate_quakes);
    year_slider.noUiSlider.on('end', recalculate_quakes);
    deaths_info_slider.noUiSlider.on('end', recalculate_quakes);

    class QuakeToolTip {
        static damage_description(quake) {
            if (quake['DAMAGE_DESCRIPTION'] == "4")
                return '<span style="color:red;">Damage: ' + DAMAGE_DESCRIPTIONS[quake['DAMAGE_DESCRIPTION']] + '</span>';
            else
                return 'Damage: ' + DAMAGE_DESCRIPTIONS[quake['DAMAGE_DESCRIPTION']];
        }

        static date(quake) {
            if (quake['YEAR'] != "" && quake['MONTH'] != '')
                return "Date: " + quake['YEAR'] + "-" + quake["MONTH"];
            else
                return "Date: " + quake['YEAR'];
        }

        static deaths(quake) {
            var deaths = quake['DEATHS'] == '' ? 0 : parseInt(quake['DEATHS']);
            if (quake['TOTAL_DEATHS'] != '' && parseInt(quake['TOTAL_DEATHS']) > deaths)
                deaths = parseInt(quake['TOTAL_DEATHS']);
            
            if (deaths > 10000) 
                return '<span style="color:red;">Deaths: ' + deaths + '</span>';
            else
                return 'Deaths: ' + deaths;
        }

        static html(quake) {
            return QuakeToolTip.date(quake)
                + "<br>" 
                + "Location: " + quake['LOCATION_NAME']
                + "<br>"
                + QuakeToolTip.damage_description(quake)
                + "<br>"
                + QuakeToolTip.deaths(quake);
        }
    }

    function range(start, end) {
        return [...Array(end - start + 1)].map((_, i) => start + i);
    }

    // workaround for https://github.com/neveldo/jQuery-Mapael/issues/253
    // shrinks the bubbles when zooming the map in, expands them on zoom-out.
    var zoom_size = 5;
    class BubblesZoom {
        static zoom() {
            var zoom_level = maparea.data("mapael").zoomData.zoomLevel;
            var new_zoom_size = zoom_level <= 10 ? 5 : 1;
            if (new_zoom_size != zoom_size) {
                zoom_size = new_zoom_size;
                recalculate_quakes();
            }
        }
    }
    maparea.on("zoom.mapael", BubblesZoom.zoom);

    function recalculate_quakes() {
        var years = year_slider.noUiSlider.get();
        var damage_descriptions = damage_slider.noUiSlider.get();
        damage_descriptions = range(
                parseInt(damage_descriptions[0]),
                parseInt(damage_descriptions[1])).join(',').replace("0", '\'\'');
        var deaths = deaths_info_slider.noUiSlider.get();

        var query = 'select * from quakes where' 
                    + ' YEAR >= __start_year__ and YEAR <= __end_year__ '
                    + ' AND DAMAGE_DESCRIPTION IN (__damage_descriptions__) '
                    + ' AND ((TOTAL_DEATHS >= __deaths_min__ AND TOTAL_DEATHS <= __deaths_max__) ';
        if (deaths[0] == "0") 
            query += "OR (DEATHS = '' OR TOTAL_DEATHS = '')";
        query +=  '   OR (DEATHS >= __deaths_min__  AND DEATHS <= __deaths_max__)) ';

        var quakes = alasql(query
                    .replace('__start_year__', years[0])
                    .replace('__end_year__', years[1])
                    .replace('__damage_descriptions__', damage_descriptions)
                    .replace('__deaths_min__', deaths[0])
                    .replace('__deaths_max__', deaths[1]));
                    

        var new_plots = {};
        for (i = 0; i < quakes.length; i++) {
          quakes[i]['latitude'] = quakes[i]['LATITUDE'];
          quakes[i]['longitude'] = quakes[i]['LONGITUDE'];
          quakes[i]['tooltip'] = {content: QuakeToolTip.html(quakes[i])};
          quakes[i]['size'] = zoom_size;
          if (quakes[i]['DAMAGE_DESCRIPTION'] == "4" 
                  || parseInt(quakes[i]['TOTAL_DEATHS']) > 10000
                  || parseInt(quakes[i]['DEATHS']) > 1000) {
              quakes[i]['attrs'] = { fill: 'red' };
          }
          new_plots[quakes[i]['I_D']] = quakes[i];
        }

        $(".mapcontainer").trigger('update', [{
            mapOptions: {'areas': {}, 'plots': {}}, 
            newPlots: new_plots,
            deletePlotKeys: Object.keys(maparea.data('mapael').plots),
            animDuration: 0 
        }]);
    };
}