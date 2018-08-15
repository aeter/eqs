var EQS = {};

EQS.main = function() {
    var DAMAGE_DESCRIPTIONS = {
        "": "UNKNOWN",
        "1": "LIMITED (<$1m (1990 USD))", 
        "2": "MODERATE ($1-5m (1990 USD))",
        "3": "SEVERE ($5-524m (1990 USD))",
        "4": "EXTREME (>525m (1990 USD))"
    }
    alasql('CREATE TABLE quakes; SELECT * INTO quakes from TSV("data/significant_quakes.tsv")');
    alasql.fn.to_date = function(x) { return new Date(x); } // for comparing dates

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
        start: [-10, 10],
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
        start: [1, 4],
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

    damage_slider.noUiSlider.on('end', recalculate_quakes);
    year_slider.noUiSlider.on('end', recalculate_quakes);

    function quake_info(quake) {
        return "Year: " + quake['YEAR'] 
                + "<br>" 
                + "Location: " + quake['LOCATION_NAME']
                + "<br>"
                + "Damage desc.: " + DAMAGE_DESCRIPTIONS[quake['DAMAGE_DESCRIPTION']];
    }

    function range(start, end) {
        return [...Array(end - start + 1)].map((_, i) => start + i);
    }

    function recalculate_quakes() {
        var years = year_slider.noUiSlider.get();
        var damage_descriptions = damage_slider.noUiSlider.get();
        damage_descriptions = range(
                parseInt(damage_descriptions[0]),
                parseInt(damage_descriptions[1])).join(',').replace("0", '\'\'');
        var query = 'select * from quakes where' 
                    + ' YEAR >= __start_year__ and YEAR <= __end_year__ '
                    + ' AND DAMAGE_DESCRIPTION IN (__damage_descriptions__) ';
        var quakes = alasql(query
                    .replace('__start_year__', years[0])
                    .replace('__end_year__', years[1])
                    .replace('__damage_descriptions__', damage_descriptions));

        var new_plots = {};
        for (i = 0; i < quakes.length; i++) {
          quakes[i]['latitude'] = quakes[i]['LATITUDE'];
          quakes[i]['longitude'] = quakes[i]['LONGITUDE'];
          quakes[i]['tooltip'] = {content: quake_info(quakes[i])};
          quakes[i]['size'] = 5;
          if (quakes[i]['DAMAGE_DESCRIPTION'] == "4") {
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
