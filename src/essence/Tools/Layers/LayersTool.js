import $ from 'jquery'
import * as d3 from 'd3'
import Sortable from 'sortablejs'
import F_ from '../../Basics/Formulae_/Formulae_'
import L_ from '../../Basics/Layers_/Layers_'
import Map_ from '../../Basics/Map_/Map_'

import DataShaders from '../../Ancillary/DataShaders'
import LayerInfoModal from './LayerInfoModal/LayerInfoModal'
import Filtering from './Filtering/Filtering'
import Help from '../../Ancillary/Help'

import tippy from 'tippy.js'
import 'markjs'

import './LayersTool.css'

const helpKey = 'LayersTool'

//Add the tool markup if you want to do it this way
// prettier-ignore
var markup = [
    "<div id='layersTool'>",
        "<div id='layersToolHeader'>",
            "<div id='filterLayers'>",
                "<div class='left'>",
                    '<div id="title">Layers</div>',
                    Help.getComponent(helpKey),
                "</div>",
                "<div class='right'>",
                    '<div class="vector" type="vector" title="Hide/Show Vector Layers"><i class="mdi mdi-vector-square mdi-18px"></i></div>',
                    '<div class="vectortile" type="vectortile" title="Hide/Show VectorTile Layers"><i class="mdi mdi-grid mdi-18px"></i></div>',
                    '<div class="tile" type="tile" title="Hide/Show Raster Layers"><i class="mdi mdi-map-outline mdi-18px"></i></div>',
                    '<div class="query" type="query" title="Hide/Show Query Layers"><i class="mdi mdi-binoculars mdi-18px"></i></div>',
                    '<div class="data" type="data" title="Hide/Show Data Layers"><i class="mdi mdi-file-table mdi-18px"></i></div>',
                    '<div class="model" type="model" title="Hide/Show Model Layers"><i class="mdi mdi-cube-outline mdi-18px"></i></div>',
                    '<div class="visible" type="visible" title="Hide/Show Off Layers"><i class="mdi mdi-eye mdi-18px"></i></div>',
                "</div>",
            "</div>",
            "<div id='searchLayers'>",
                '<i class="mdi mdi-magnify mdi-18px"></i>',
                "<input type='text' placeholder='Search Layers (# for tags)' />",
                '<div id="clear"><i class="mdi mdi-close mdi-18px"></i></div>',
                '<div id="expand"><i class="mdi mdi-arrow-expand-vertical mdi-18px"></i></div>',
                '<div id="collapse"><i class="mdi mdi-arrow-collapse-vertical mdi-18px"></i></div>',
            "</div>",
        "</div>",
        "<div id='layersToolContent'>",
            "<ul id='layersToolList'>",
            "</ul>",
        "</div>",
    "</div>",
].join('\n')

// These layers are a bit different and we need to account for that.
// Either they have no map data or not initial data
const quasiLayers = ['model', 'query']
const DEPTH_SIZE = 13
const INDENT_COLOR = 'var(--color-a)'

var LayersTool = {
    height: 0,
    width: 340,
    vars: {},
    MMGISInterface: null,
    orderingHistory: [],
    initialize: function () {
        //Get tool variables
        this.vars = L_.getToolVars('layers')

        // set custom width
        if (this.vars.width) {
            this.width = this.vars.width
        }
    },
    finalize: function () {
        //Order layers from url
        if (L_.FUTURES.tools) {
            for (let t of L_.FUTURES.tools) {
                const tUrl = t.split('$')
                if (tUrl[0] === 'LayersTool') {
                    LayersTool.orderingHistory = []
                    const orderHistory = tUrl[1].split('.')
                    orderHistory.forEach((o) => {
                        const oSplit = o.split('-')
                        LayersTool.orderingHistory.push([
                            parseInt(oSplit[0]),
                            parseInt(oSplit[1]),
                            parseInt(oSplit[2]),
                        ])
                    })
                    break
                }
            }
        }
        if (LayersTool.orderingHistory.length > 0) {
            LayersTool.make(null, true)
            LayersTool.destroy()
        }
    },
    make: function (t, fromInit) {
        this.MMGISInterface = new interfaceWithMMGIS(fromInit)
    },
    destroy: function () {
        this.MMGISInterface.separateFromMMGIS()
    },
    getUrlString: function () {
        if (LayersTool.orderingHistory.length === 0) return ''
        return LayersTool.orderingHistory
            .map((hist) => `${hist[0]}-${hist[1]}-${hist[2]}`)
            .join('.')
    },
    setHeader: function () {},
    toggleHeader: function (elmIndex) {
        var found = false
        var done = false
        var elmDepth = 0
        var wasOn = false
        $('#layersToolList > li').each(function () {
            if (done) return
            var t = $(this)
            if (t.attr('id') == elmIndex) {
                found = true
                elmDepth = t.attr('depth')
                wasOn = t.attr('childrenon') == 'true'
                t.attr('childrenon', wasOn ? 'false' : 'true')
                t.find('.headerChevron').toggleClass('mdi-chevron-right')
                t.find('.headerChevron').toggleClass('mdi-chevron-down')
            } else if (found) {
                if (t.attr('type') == 'header' && t.attr('depth') <= elmDepth) {
                    done = true
                } else if (t.attr('depth') <= elmDepth) {
                    done = true
                } else {
                    const nextDepth =
                        parseInt(t.attr('depth')) > parseInt(elmDepth)

                    if (wasOn) {
                        if (nextDepth) t.attr('on', 'false')
                        t.css('overflow', 'hidden')
                        t.css('height', wasOn ? '0' : 'auto')
                        t.css('margin-top', wasOn ? '0px' : '1px')
                        t.css('margin-bottom', wasOn ? '0px' : '1px')
                    } else {
                        if (t.attr('on') == 'true' || nextDepth) {
                            t.css('height', 'auto')
                            t.css('margin-top', '1px')
                            t.css('margin-bottom', '1px')
                        }
                        if (nextDepth) t.attr('on', 'true')
                    }
                }
            }
        })
    },
}

//
function interfaceWithMMGIS(fromInit) {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    var tools = d3.select('#toolPanel')
    //Clear it
    tools.selectAll('*').remove()
    //Add a semantic container
    tools = tools.append('div').style('height', '100%')
    if (fromInit) tools.style('display', 'none')
    //Add the markup to tools or do it manually
    tools.html(markup)

    Help.finalize(helpKey)

    let headerI = 0

    //This is where the layers list is created in the tool panel.
    depthTraversal(L_.layers, {}, 0)

    function depthTraversal(node, parent, depth) {
        for (var i = 0; i < node.length; i++) {
            let currentOpacity
            let currentBrightness
            let currentContrast
            let currentSaturation
            let currentBlend

            //Build layerExport
            var layerExport
            switch (node[i].type) {
                case 'vector':
                case 'query':
                    // prettier-ignore
                    layerExport = [
                        '<ul>',
                            L_.Coordinates.mainType != 'll' ? ['<li>',
                                '<div class="layersToolExportGeoJSON">',
                                    `<div>Export GeoJSON (${L_.Coordinates.getMainTypeName()})</div>`,
                                '</div>',
                            '</li>'].join('\n') : '',
                            '<li>',
                                '<div class="layersToolExportSourceGeoJSON">',
                                    `<div>Export GeoJSON ${L_.Coordinates.mainType != 'll' ? '(lonlat)' : '' }</div>`,
                                '</div>',
                            '</li>',
                        '</ul>',
                    ].join('\n')
                    break
                default:
                    layerExport = ''
            }

            // Build timeDisplay
            var timeDisplay = ''
            if (node[i].time != null) {
                if (node[i].time.enabled == true) {
                    timeDisplay = [
                        '<ul>',
                        '<li>',
                        '<div>',
                        '<div>Start Time</div>',
                        '<label class="starttime ' +
                            F_.getSafeName(node[i].name) +
                            '">' +
                            node[i].time.start +
                            '</label>',
                        '</div>',
                        '</li>',
                        '<li>',
                        '<div>',
                        '<div>End Time</div>',
                        '<label class="endtime ' +
                            F_.getSafeName(node[i].name) +
                            '">' +
                            node[i].time.end +
                            '</label>',
                        '</div>',
                        '</li>',
                        '</ul>',
                    ].join('\n')
                }
            }

            //Build settings object
            var settings
            switch (node[i].type) {
                case 'vector':
                case 'vectortile':
                    currentOpacity = L_.getLayerOpacity(node[i].name)
                    if (currentOpacity == null)
                        currentOpacity = L_.opacityArray[node[i].name]

                    // prettier-ignore
                    settings = [
                        '<ul>',
                            '<li>',
                                '<div>',
                                    '<div>Opacity</div>',
                                        '<input class="transparencyslider slider2" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.01" value="' + currentOpacity + '" default="' + L_.opacityArray[node[i].name] + '">',
                                    '</div>',
                                    L_.layersGroupSublayers[node[i].name] ? `<div class="sublayerHeading">Composite Layers</div>` : null,
                                    L_.layersGroupSublayers[node[i].name] ? Object.keys(L_.layersGroupSublayers[node[i].name]).map((function(i){return function(s) {
                                        return L_.layersGroupSublayers[node[i].name][s] === false ? '' : [
                                            '<div class="sublayer">',
                                                `<div title="${L_.layersGroupSublayers[node[i].name][s].title || ''}">${F_.prettifyName(s)}</div>`,
                                                '<div style="display: flex;">',
                                                    L_.layersGroupSublayers[node[i].name][s].layer?.dropdown ? [
                                                        `<select class="dropdown sublayerDropdown" layername="${node[i].name}" sublayername="${s}">`,
                                                            L_.layersGroupSublayers[node[i].name][s].layer?.dropdown.map((d) =>
                                                                `<option value="${d}"${(d === L_.layersGroupSublayers[node[i].name][s].layer?.dropdownValue  ? ' selected' : '')}>${d}</option>`
                                                            ).join('\n'),
                                                        '</select>'
                                                    ].join('\n') : null,
                                                    '<div class="checkboxcont">',
                                                        `<div class="checkbox small ${(L_.layersGroupSublayers[node[i].name][s].on ? 'on' : 'off')}" layername="${node[i].name}" sublayername="${s}" style="margin: 7px 0px 7px 10px;"></div>`,
                                                    '</div>',
                                                '</div>',
                                            '</div>'
                                        ].join('\n')
                                    }})(i)).join('\n') : null,
                                '</div>',
                            '</li>',
                        '</ul>',
                    ].join('\n')
                    break
                case 'tile':
                    currentOpacity = L_.getLayerOpacity(node[i].name)
                    if (currentOpacity == null)
                        currentOpacity = L_.opacityArray[node[i].name]

                    currentBrightness = 1
                    currentContrast = 1
                    currentSaturation = 1
                    currentBlend = 'none'
                    if (L_.layerFilters[node[i].name]) {
                        let f = L_.layerFilters[node[i].name]

                        currentBrightness =
                            f['brightness'] == null
                                ? 1
                                : parseFloat(f['brightness'])
                        currentContrast =
                            f['contrast'] == null
                                ? 1
                                : parseFloat(f['contrast'])
                        currentSaturation =
                            f['saturate'] == null
                                ? 1
                                : parseFloat(f['saturate'])
                        currentBlend =
                            f['mix-blend-mode'] == null
                                ? 'none'
                                : f['mix-blend-mode']
                    }

                    // prettier-ignore
                    settings = [
                        '<ul>',
                            '<li>',
                                '<div>',
                                    '<div>Opacity</div>',
                                    '<input class="transparencyslider slider2" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.01" value="' + currentOpacity + '" default="' + L_.opacityArray[node[i].name] + '">',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                    '<div>Brightness</div>',
                                        '<input class="tilefilterslider slider2" filter="brightness" unit="%" layername="' + node[i].name + '" type="range" min="0" max="3" step="0.05" value="' + currentBrightness + '" default="1">',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                    '<div>Contrast</div>',
                                    '<input class="tilefilterslider slider2" filter="contrast" unit="%" layername="' + node[i].name + '" type="range" min="0" max="4" step="0.05" value="' + currentContrast + '" default="1">',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                    '<div>Saturation</div>',
                                    '<input class="tilefilterslider slider2" filter="saturate" unit="%" layername="' + node[i].name + '" type="range" min="0" max="4" step="0.05" value="' + currentSaturation + '" default="1">',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                    '<div>Blend</div>',
                                    '<select class="tileblender dropdown" layername="' + node[i].name + '">',
                                        '<option value="unset"' + (currentBlend == 'none' ? ' selected' : '') + '>None</option>',
                                        '<option value="color"' + (currentBlend == 'color' ? ' selected' : '') + '>Color</option>',
                                        //'<option value="color-burn">Color Burn</option>',
                                        //'<option value="color-dodge">Color Dodge</option>',
                                        //'<option value="darken">Darken</option>',
                                        //'<option value="difference">Difference</option>',
                                        //'<option value="exclusion">Exclusion</option>',
                                        //'<option value="hard-light">Hard Light</option>',
                                        //'<option value="hue">Hue</option>',
                                        //'<option value="lighten">Lighten</option>',
                                        //'<option value="luminosity">Luminosity</option>',
                                        //'<option value="multiply">Multiply</option>',
                                        '<option value="overlay"' + (currentBlend == 'overlay' ? ' selected' : '') + '>Overlay</option>',
                                        //'<option value="saturation">Saturation</option>',
                                        //'<option value="screen">Screen</option>',
                                        //'<option value="soft-light" ' + (currentBlend == 'soft-light' ? ' selected' : '') + '>Soft Light</option>',
                                    '</select>',
                                '</div>',
                            '</li>',
                            /*
                            '<li>',
                                '<div>',
                                    '<div>Hue</div>',
                                    '<input class="tilefilterslider slider2" filter="hue-rotate"  unit="deg" layername="' + node[i].name + '" type="range" min="0" max="3.60" step="0.1" value="0" default="0">',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                    '<div>Invert</div>',
                                    '<input class="tilefilterslider slider2" filter="invert"  unit="%" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.05" value="0" default="0">',
                                '</div>',
                            '</li>',
                            */
                        '</ul>'
                    ].join('\n')
                    break
                case 'data':
                    currentOpacity = L_.getLayerOpacity(node[i].name)
                    if (currentOpacity == null)
                        currentOpacity = L_.opacityArray[node[i].name]

                    currentBlend = 'none'
                    if (L_.layerFilters[node[i].name]) {
                        let f = L_.layerFilters[node[i].name]

                        currentBlend =
                            f['mix-blend-mode'] == null
                                ? 'none'
                                : f['mix-blend-mode']
                    }

                    let additionalSettings = ''
                    const shader = F_.getIn(node[i], 'variables.shader')

                    if (shader && DataShaders[shader.type]) {
                        // prettier-ignore
                        additionalSettings = [
                            DataShaders[shader.type].getHTML(node[i].name, shader)
                        ].join('\n')
                    }

                    // prettier-ignore
                    settings = [
                        '<ul>',
                            '<li>',
                                '<div>',
                                    '<div>Opacity</div>',
                                    '<input class="transparencyslider slider2" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.01" value="' + currentOpacity + '" default="' + L_.opacityArray[node[i].name] + '">',
                                '</div>',
                            '</li>',
                            '<li>',
                                '<div>',
                                    '<div>Blend</div>',
                                    '<select class="tileblender dropdown" layername="' + node[i].name + '">',
                                        '<option value="unset"' + (currentBlend == 'none' ? ' selected' : '') + '>None</option>',
                                        '<option value="color"' + (currentBlend == 'color' ? ' selected' : '') + '>Color</option>',
                                        '<option value="overlay"' + (currentBlend == 'overlay' ? ' selected' : '') + '>Overlay</option>',
                                    '</select>',
                                '</div>',
                            '</li>',
                            additionalSettings,
                        '</ul>'
                    ].join('\n')
                    break
                case 'model':
                case 'query':
                    // prettier-ignore
                    settings = [
                        '<ul>',
                            '<li>',
                                '<div>',
                                    '<div>Opacity</div>',
                                    '<input class="transparencyslider slider2" layername="' + node[i].name + '" type="range" min="0" max="1" step="0.01" value="' + currentOpacity + '" default="' + L_.opacityArray[node[i].name] + '">',
                                '</div>',
                            '</li>',
                        '</ul>',
                    ].join('\n')
                    break
                default:
                    settings = ''
            }

            //Build and add layer object
            switch (node[i].type) {
                case 'header':
                    // prettier-ignore
                    $('#layersToolList').append(
                        [
                            `<li class="layersToolHeader" id="header_${headerI}" name="${node[i].name}" type="${node[i].type}" depth="${depth}" childrenon="true" style="margin-bottom: 1px;">`,
                                `<div class="title" id="headerstart" style="border-left: ${depth * DEPTH_SIZE}px solid ${INDENT_COLOR};">`,
                                    '<div class="layersToolColor ' + node[i].type + '">',
                                        '<i class="mdi mdi-drag-vertical mdi-12px"></i>',
                                    '</div>',
                                    '<div>',
                                        '<i class="headerChevron mdi mdi-chevron-down mdi-24px"></i>',
                                    '</div>',
                                    `<div class="layerName" title="${node[i].name}">`,
                                        node[i].name,
                                    '</div>',
                                    '<div class="layerCount">',
                                        (node[i].sublayers ? node[i].sublayers.length : '0'),
                                    '</div>',
                                    '<div title="Information" class="LayersToolInfo" id="layerinfo' + F_.getSafeName(node[i].name) + '" stype="' + node[i].type + '" layername="' + node[i].name + '">',
                                        '<i class="mdi mdi-information-outline mdi-18px" name="layerinfo"></i>',
                                    '</div>',
                                    `<div class="headerPowerState ${'on'}" title="Toggle all on inner-layers on or off.">`,
                                        '<i class="mdi mdi-power-off mdi-18px"></i>',
                                    '</div>',
                                '</div>',
                            '</li>',
                        ].join('\n'))
                    headerI++
                    break
                default:
                    // prettier-ignore
                    $('#layersToolList').append(
                        [
                            '<li id="LayersTool' + F_.getSafeName(node[i].name) + '" class="' + ((!quasiLayers.includes(node[i].type) && L_.layersGroup[node[i].name] == null) ? 'layernotfound' : '') + '" type="' + node[i].type + '" on="true" depth="' + depth + '" name="' + node[i].name + '" parent="' + parent.name + '"  style="margin-bottom: 1px;">',
                                `<div class="title" id="layerstart${F_.getSafeName(node[i].name)}" style="border-left: ${depth * DEPTH_SIZE}px solid ${INDENT_COLOR};">`,
                                    '<div class="layersToolColor ' + node[i].type + '">',
                                        '<i class="mdi mdi-drag-vertical mdi-12px"></i>',
                                    '</div>',
                                    '<div class="checkboxcont">',
                                        '<div class="checkbox ' + (L_.toggledArray[node[i].name] ? 'on' : 'off') + '"></div>',
                                    '</div>',
                                    `<div class="layerName" title="${node[i].name}">`,
                                        node[i].name,
                                    '</div>',
                                    '<div class="reset">',
                                        '<i class="mdi mdi-refresh mdi-18px"></i>',
                                    '</div>',
                                    (layerExport != '') ? ['<div title="Download" class="layerDownload" id="layerexport' + F_.getSafeName(node[i].name) + '" stype="' + node[i].type + '" layername="' + node[i].name + '">',
                                        '<i class="mdi mdi-download mdi-18px" name="layerexport"></i>',
                                    '</div>'].join('\n') : '',
                                    (timeDisplay != '') ? ['<div class="time" id="timesettings' + F_.getSafeName(node[i].name) + '" stype="' + node[i].type + '" layername="' + node[i].name + '">',
                                        '<i class="mdi mdi-clock mdi-18px" name="timesettings" style="color:' + node[i].time.status + '"></i>',
                                    '</div>'].join('\n') : '',
                                    '<div title="Settings" class="gears" id="layersettings' + F_.getSafeName(node[i].name) + '" stype="' + node[i].type + '" layername="' + node[i].name + '">',
                                        '<i class="mdi mdi-tune mdi-18px" name="layersettings"></i>',
                                    '</div>',
                                    '<div title="Information" class="LayersToolInfo" id="layerinfo' + F_.getSafeName(node[i].name) + '" stype="' + node[i].type + '" layername="' + node[i].name + '">',
                                        '<i class="mdi mdi-information-outline mdi-18px" name="layerinfo"></i>',
                                    '</div>',
                                '</div>',
                                '<div class="layerExport ' + node[i].type + '">',
                                    layerExport,
                                '</div>',
                                '<div class="timeDisplay settings ' + node[i].type + '">',
                                    timeDisplay,
                                '</div>',
                                '<div class="settings settingsmain' + node[i].type + '">',
                                    settings,
                                '</div>',
                            '</li>',
                        ].join('\n')
                    )

                    //Attach DataShader events
                    if (node[i].type === 'data') {
                        const shader = F_.getIn(node[i], 'variables.shader')
                        if (
                            shader &&
                            DataShaders[shader.type] &&
                            typeof DataShaders[shader.type].attachEvents ===
                                'function'
                        )
                            DataShaders[shader.type].attachEvents(
                                node[i].name,
                                shader
                            )
                    }
                    break
            }

            if (node[i].sublayers)
                depthTraversal(node[i].sublayers, node[0], depth + 1)
        }
    }

    async function toggleLayer(checkbox) {
        let li = checkbox.parent().parent().parent()
        if (li.attr('type') !== 'header') {
            checkbox.addClass('loading')
            await L_.toggleLayer(L_.layersNamed[li.attr('name')])
            checkbox.removeClass('loading')
            if (
                quasiLayers.includes(li.attr('type')) ||
                L_.layersGroup[li.attr('name')]
            )
                checkbox.toggleClass('on')
            else if (
                !quasiLayers.includes(li.attr('type')) &&
                L_.layersGroup[li.attr('name')] == null
            )
                li.addClass('layernotfound')

            // Dispatch `layerVisibilityChange` event
            const layerName = li.attr('name')
            let _event = new CustomEvent('layerVisibilityChange', {
                detail: {
                    layer: L_.layersNamed[layerName],
                    layerName,
                    visible: L_.toggledArray[layerName],
                },
            })
            document.dispatchEvent(_event)
        }
    }
    //Add event functions and whatnot
    //Makes layers clickable on and off
    $('#layersToolList > li > .title .checkbox').on('click', function () {
        // First, find all parents header (if any), and set power state to on again
        const elm = $(this).parent().parent().parent()
        const elmIdx = $('#layersToolList > li').index(elm)
        const elmDepth = parseInt(elm.attr('depth'))
        // We need exactly one depth for each depth above elmDepth to 0
        const depthsChecklist = {}
        const listLis = $('#layersToolList').children('li').get()
        $(listLis.reverse()).each(function (idx, item) {
            idx = listLis.length - 1 - idx
            if (idx < elmIdx && $(item).attr('type') === 'header') {
                const depth = parseInt($(item).attr('depth'))
                if (depth < elmDepth && depthsChecklist[depth] == null) {
                    depthsChecklist[depth] = true
                    // Switch power state
                    $(item).find('.headerPowerState').addClass('on')
                    $(item).find('.headerPowerState i').removeClass('mdi-power')
                    $(item)
                        .find('.headerPowerState i')
                        .addClass('mdi-power-off')
                }
            }
        })

        // Then toggle as normal
        toggleLayer($(this))
    })

    $('#layersToolList > li > .settings .sublayer .dropdown').on(
        'change',
        function () {
            const layerName = $(this).attr('layername')
            const sublayerName = $(this).attr('sublayername')
            $(this).val()

            if (
                L_.layersGroupSublayers[layerName] &&
                L_.layersGroupSublayers[layerName][sublayerName]
            ) {
                const l = L_.layersGroupSublayers[layerName][sublayerName]
                l.layer.dropdownFunc(
                    layerName,
                    sublayerName,
                    Map_,
                    $(this).val()
                )
            }
        }
    )
    //Makes sublayers clickable on and off
    $('#layersToolList > li > .settings .sublayer .checkbox').on(
        'click',
        async function () {
            const layerName = $(this).attr('layername')
            const sublayerName = $(this).attr('sublayername')

            await L_.toggleSublayer(layerName, sublayerName)

            if (
                L_.layersGroupSublayers[layerName] &&
                L_.layersGroupSublayers[layerName][sublayerName]
            ) {
                if (L_.layersGroupSublayers[layerName][sublayerName].on)
                    $(this).addClass('on')
                else $(this).removeClass('on')
            }
        }
    )

    // Collapse header
    $('.layersToolHeader').on('click', function () {
        LayersTool.toggleHeader($(this).attr('id'))
    })
    // Toggle between all-off and previous-on states
    // Power state switches back to on if any inner layer is toggled (done elsewhere)
    $('.headerPowerState').on('click', function (e) {
        e.stopPropagation()

        const wasOn = $(this).hasClass('on')
        const headElm = $(this).parent().parent()
        const name = headElm.attr('name')
        const elmIdx = $('#layersToolList > li').index(headElm)
        const elmDepth = parseInt(headElm.attr('depth'))

        if (wasOn) {
            // Then turn off
            LayersTool._header_states = LayersTool._header_states || {}
            LayersTool._header_states[name] = []
            // Iterate every layer below
            let stillUnder = true
            $('#layersToolList')
                .children('li')
                .each(function (idx, item) {
                    if (idx > elmIdx) {
                        if (stillUnder && $(item).attr('depth') > elmDepth) {
                            // Save state and then turn off
                            if (
                                L_.toggledArray[$(item).attr('name')] &&
                                $(item).attr('type') !== 'header'
                            ) {
                                LayersTool._header_states[name].push(
                                    $(item).attr('name')
                                )
                                toggleLayer($(item).find('.title .checkbox'))
                            }
                        } else {
                            stillUnder = false
                        }
                    }
                })
            // Finally switch power state
            $(this).removeClass('on')
            $(this).find('i').removeClass('mdi-power-off')
            $(this).find('i').addClass('mdi-power')
        } else {
            // Then turn on
            if (LayersTool._header_states && LayersTool._header_states[name]) {
                LayersTool._header_states[name].forEach((layerName) => {
                    toggleLayer(
                        $(
                            `#LayersTool${F_.getSafeName(
                                layerName
                            )} .title .checkbox`
                        )
                    )
                })
            }

            // Finally switch power state
            $(this).addClass('on')
            $(this).find('i').removeClass('mdi-power')
            $(this).find('i').addClass('mdi-power-off')
        }
    })

    //Enables the export dialogue box
    $('.layerName, .layerDownload').on('click', function () {
        var li = $(this).parent().parent()
        if (li.attr('type') == 'header') return
        var wasOn = li.hasClass('download_on')
        $('.layerDownload').parent().parent().removeClass('download_on')
        $('.gears').parent().parent().removeClass('gears_on')
        if (!wasOn) li.addClass('download_on')
    })
    //Enables the setting dialogue box
    $('.layerName, .gears').on('click', async function () {
        const li = $(this).parent().parent()
        const type = li.attr('type')
        const layerName = li.attr('name')
        if (type === 'header') return

        const wasOn = li.hasClass('gears_on')
        $('.layerDownload').parent().parent().removeClass('download_on')
        $('.gears').parent().parent().removeClass('gears_on')
        if (!wasOn) li.addClass('gears_on')

        //Support Filtering 1
        if (['vector', 'query'].includes(type)) {
            Filtering.destroy()
        }

        // Turn layer on if off
        const checkbox = $(this).parent().find('.checkboxcont .checkbox')
        if (!checkbox.hasClass('on')) await toggleLayer(checkbox)

        //Support Filtering 2
        if (!wasOn) {
            if (['vector', 'query'].includes(type)) {
                if (!wasOn) Filtering.make($(this).parent().parent(), layerName)
            }
        }
    })
    //Enables the time dialogue box
    $('.LayersToolInfo').on('click', function (e) {
        e.stopPropagation()
        const layerName = $(this).attr('layername')
        LayerInfoModal.open(layerName)
    })
    //Enables the time dialogue box
    $('.layerName, .time').on('click', function () {
        var li = $(this).parent().parent()
        if (li.attr('type') == 'header') return
        var wasOn = li.hasClass('time_on')
        $('.time').parent().parent().removeClass('time_on')
        if (!wasOn) li.addClass('time_on')
    })

    //Export GeoJSON
    $('.layersToolExportGeoJSON').on('click', function () {
        var li = $(this).parent().parent().parent().parent()

        let layerName = li.attr('name')
        F_.downloadObject(
            L_.convertGeoJSONLngLatsToPrimaryCoordinates(
                L_.layersGroup[layerName].toGeoJSON(L_.GEOJSON_PRECISION)
            ),
            layerName,
            '.json'
        )
    })
    //Export Source GeoJSON
    $('.layersToolExportSourceGeoJSON').on('click', function () {
        var li = $(this).parent().parent().parent().parent()

        let layerName = li.attr('name')
        F_.downloadObject(
            L_.layersGroup[layerName].toGeoJSON(L_.GEOJSON_PRECISION),
            layerName,
            '.json'
        )
    })

    //Refresh settings
    $('.reset').on('click', function () {
        var li = $(this).parent().parent()

        L_.setLayerOpacity(li.attr('name'), 1)
        li.find('.transparencyslider').val(1)

        L_.setLayerFilter(li.attr('name'), 'clear')

        li.find('.tilefilterslider').each(function () {
            $(this).val($(this).attr('default'))
        })

        li.find('.tileblender').val('unset')
    })

    //Applies slider values to map layers
    $('.transparencyslider').on('input', function () {
        var texttransp = $(this).val()
        L_.setLayerOpacity($(this).attr('layername'), texttransp)
        $(this)
            .parent()
            .find('span')
            .text(parseInt(texttransp * 100) + '%')
    })

    //Applies slider values to map layers
    $('.tilefilterslider').on('input', function () {
        var val = $(this).val()
        L_.setLayerFilter(
            $(this).attr('layername'),
            $(this).attr('filter'),
            $(this).val()
        )
        $(this)
            .parent()
            .find('span')
            .text(parseInt(val * 100) + $(this).attr('unit'))
    })

    $('.tileblender').on('change', function () {
        L_.setLayerFilter(
            $(this).attr('layername'),
            'mix-blend-mode',
            $(this).val()
        )
    })

    let tags = []
    Object.keys(L_.layersNamed).forEach((l) => {
        if (L_.layersNamed[l].tags) tags = tags.concat(L_.layersNamed[l].tags)
    })
    // Remove duplicates
    tags = tags.filter((c, idx) => {
        return tags.indexOf(c) === idx
    })

    $('#searchLayers > input').autocomplete({
        lookup: tags,
        lookupLimit: 400,
        minChars: 1,
        transformResult: function (response, originalQuery) {
            response.suggestions = []
            if (originalQuery[0] === '#') {
                const queryWithoutHash = originalQuery.substring(1)

                tags.forEach((tag) => {
                    if (
                        queryWithoutHash === '' ||
                        tag.toLowerCase().indexOf(queryWithoutHash) != -1
                    ) {
                        response.suggestions.push({ value: tag, data: null })
                    }
                })
            }
            return response
        },
        onSelect: function (event) {
            $('#searchLayers > input')
                .val(`#${event.value}`)
                .trigger('input')
                .trigger('blur')
        },
    })

    tippy('#searchLayers > input', {
        content:
            'Search layers by Name and Description. Prefix with # to search over tags.',
        placement: 'right',
        theme: 'blue',
    })

    $('#searchLayers > input').on('input', function () {
        $('#searchLayers > #expand').click()
        const filterString = $(this).val().toLowerCase()

        if (filterString == null || filterString == '')
            $('#searchLayers > #clear').removeClass('shown')
        else $('#searchLayers > #clear').addClass('shown')

        markAll()
        function getThats() {
            let thats = []
            $('#layersToolList > li').each(function () {
                if ($(this).attr('type') != 'header') {
                    if (filterString == null || filterString == '') {
                        $(this).css('height', 'auto')
                        $(this).css('margin-top', '1px')
                        $(this).css('margin-bottom', '1px')
                        //Mark
                        $(this).unmark()
                    } else {
                        thats.push(this)
                    }
                }
            })
            return thats
        }

        function markAll() {
            let thats = getThats()
            //look through name and highlight
            thats.forEach((that) => {
                $(that).unmark({
                    done: function () {
                        $(that).markRegExp(new RegExp(filterString, 'i'), {
                            done: function () {
                                if ($(that).find('mark').length == 0) {
                                    $(that).css('height', 0)
                                    $(that).css('margin-top', '0px')
                                    $(that).css('margin-bottom', '0px')
                                } else {
                                    $(that).css('height', 'auto')
                                    $(that).css('margin-top', '1px')
                                    $(that).css('margin-bottom', '1px')
                                }
                            },
                        })
                    },
                })

                const layerName = $(that).attr('name')
                const layerObj = L_.layersNamed[layerName]

                if (layerObj) {
                    //Look at description
                    if (
                        layerObj.description &&
                        layerObj.description.indexOf(filterString) != -1
                    ) {
                        $(that).css('height', 'auto')
                        $(that).css('margin-top', '1px')
                        $(that).css('margin-bottom', '1px')
                    }
                    //look at tag
                    if (layerObj.tags) {
                        const filterStringWords = filterString.split(' ')
                        filterStringWords.forEach((word) => {
                            if (word[0] === '#') {
                                const filterTag = word.substring(1)
                                for (let i = 0; i < layerObj.tags.length; i++) {
                                    if (
                                        layerObj.tags[i]
                                            .toLowerCase()
                                            .indexOf(filterTag) != -1
                                    ) {
                                        $(that).css('height', 'auto')
                                        $(that).css('margin-top', '1px')
                                        $(that).css('margin-bottom', '1px')
                                        break
                                    }
                                }
                            }
                        })
                    }
                }
            })
        }
    })
    $('#searchLayers > #clear').on('click', function () {
        $('#searchLayers > input').val('').trigger('input')
    })
    $('#searchLayers > #expand').on('click', function () {
        $('#layersToolList > li').each(function () {
            if (
                $(this).attr('type') == 'header' &&
                $(this).attr('childrenon') == 'false'
            ) {
                LayersTool.toggleHeader($(this).attr('id'))
            }
        })
    })

    $('#searchLayers > #collapse').on('click', function () {
        $('#layersToolList > li').each(function () {
            if (
                $(this).attr('type') == 'header' &&
                $(this).attr('childrenon') == 'true'
            ) {
                LayersTool.toggleHeader($(this).attr('id'))
            }
        })
    })

    $('#filterLayers .right > div').on('click', function () {
        $(this).toggleClass('on')
        var isOn = $(this).hasClass('on')
        var type = $(this).attr('type')
        const ons = {
            vector: $('#filterLayers .right > .vector').hasClass('on'),
            vectortile: $('#filterLayers .right > .vectortile').hasClass('on'),
            tile: $('#filterLayers .right > .tile').hasClass('on'),
            query: $('#filterLayers .right > .query').hasClass('on'),
            data: $('#filterLayers .right > .data').hasClass('on'),
            model: $('#filterLayers .right > .model').hasClass('on'),
            visible: $('#filterLayers .right > .visible').hasClass('on'),
        }
        $('#layersToolList > li').each(function () {
            if ($(this).attr('type') !== 'header') {
                if (type === 'visible') {
                    var layerOn = $(this).find('.checkbox').hasClass('on')
                    if (isOn) {
                        if (layerOn) $(this).removeClass('forceOff2')
                        else $(this).addClass('forceOff2')
                    } else $(this).removeClass('forceOff2')
                } else {
                    if (
                        !ons.vector &&
                        !ons.vectortile &&
                        !ons.tile &&
                        !ons.query &&
                        !ons.data &&
                        !ons.model
                    )
                        $(this).removeClass('forceOff')
                    else {
                        const liType = $(this).attr('type')
                        if (ons[liType]) $(this).removeClass('forceOff')
                        else $(this).addClass('forceOff')
                    }
                }
            }
        })
    })

    // Make it all sortable
    function sortOnStart(e) {
        const type = $(e.item).attr('type')
        LayersTool._drag_oldDepth = parseInt($(e.item).attr('depth'))
        const oldIdx = e.oldIndex

        LayersTool._drag_lisToMoveUnderHeader = []
        if (type === 'header') {
            let stillUnder = true
            $('#layersToolList')
                .children('li')
                .each(function (idx, item) {
                    if (idx > oldIdx) {
                        if (
                            stillUnder &&
                            $(item).attr('depth') > LayersTool._drag_oldDepth
                        )
                            LayersTool._drag_lisToMoveUnderHeader.push(item)
                        else {
                            stillUnder = false
                        }
                    }
                })
        }
    }
    function sortOnChange(e) {
        // In here we want to change the indentation of our dragged layer to match
        // the indentation of the layer above (on none if at top)
        LayersTool._drag_newDepth = 0
        LayersTool._drag_headerState = 0
        if (e.newIndex > 0) {
            // We need to look for the next VISIBLE above element
            let aboveElm
            let upIdx = e.newIndex
            if (e.downward === true) upIdx++

            while (upIdx >= 0) {
                aboveElm = $(`#layersToolList > li:nth-child(${upIdx})`)
                if (aboveElm.attr('on') !== 'false') upIdx = 0
                upIdx--
            }
            if (aboveElm.length > 0) {
                LayersTool._drag_newDepth = parseInt(aboveElm.attr('depth'))
                const type = aboveElm.attr('type')

                if (
                    (e.afterHeader === 0 &&
                        aboveElm.attr('childrenon') === 'false') ||
                    (e.afterHeader === 1 &&
                        aboveElm.attr('childrenon') === 'true')
                ) {
                    // toggle header because it's in the opposite state than history requires
                    LayersTool.toggleHeader(aboveElm.attr('id'))
                }

                if (type === 'header') {
                    if (aboveElm.attr('childrenon') === 'true') {
                        LayersTool._drag_newDepth++
                        LayersTool._drag_headerState = 2
                    } else {
                        LayersTool._drag_headerState = 1
                    }
                }
            }
        }

        // If header and open, depth++
        $(e.item).attr('depth', LayersTool._drag_newDepth)
        $(e.item)
            .find('.title')
            .css({
                'border-left': `${
                    LayersTool._drag_newDepth * DEPTH_SIZE
                }px solid ${INDENT_COLOR}`,
            })

        return true
    }
    function sortOnEnd(e) {
        const type = $(e.item).attr('type')
        // Sortable will place before all hidden layers, we want it always to be after
        // Move to the end of all hidden / on="false" layers
        let downIdx = e.newIndex + 1
        let keepGoing = true
        let nextElm
        let afterElm
        const totalLayers = $(`#layersToolList > li`).length

        nextElm = $(`#layersToolList > li:nth-child(${e.newIndex})`)
        if (
            nextElm.attr('type') === 'header' &&
            nextElm.attr('childrenon') === 'false'
        ) {
            downIdx++
        }
        while (e.newIndex > 0 && keepGoing) {
            nextElm = $(`#layersToolList > li:nth-child(${downIdx})`)
            if (nextElm.length > 0) {
                if (
                    downIdx >= totalLayers ||
                    parseInt(nextElm.css('height')) > 0
                ) {
                    afterElm = $(
                        `#layersToolList > li:nth-child(${
                            downIdx + (downIdx >= totalLayers ? 0 : -1)
                        })`
                    )
                    keepGoing = false
                } else {
                    downIdx++
                }
            } else {
                keepGoing = false
            }
        }
        if (afterElm) {
            $(e.item).insertAfter(afterElm)
        } else $(`#layersToolList`).prepend($(e.item))

        if (type === 'header') {
            // If a header was moved, now move everything under it along with it
            // If a user drags a header into its own contents, nothing must happen
            // Inner layers must shift depth along with header depth
            if (LayersTool._drag_lisToMoveUnderHeader.length > 0) {
                let curItem = e.item
                LayersTool._drag_lisToMoveUnderHeader.forEach((item) => {
                    let depth = parseInt($(item).attr('depth'))
                    depth +=
                        LayersTool._drag_newDepth - LayersTool._drag_oldDepth
                    $(item).insertAfter($(curItem))
                    $(item).attr('depth', depth)
                    $(item)
                        .find('.title')
                        .css({
                            'border-left': `${
                                depth * DEPTH_SIZE
                            }px solid ${INDENT_COLOR}`,
                        })
                    curItem = item
                })
            }
        }
        if (e.ignoreHistory !== true)
            LayersTool.orderingHistory.push([
                e.oldIndex,
                e.newIndex,
                LayersTool._drag_headerState,
            ])
        if (e.ignoreFinalOrder !== true) {
            // Set reorder in data model
            const newLayersOrdered = []
            $('#layersToolList')
                .children('li')
                .each(function () {
                    if (
                        $(this).attr('type') !== 'header' &&
                        $(this).attr('name') != null
                    )
                        newLayersOrdered.push($(this).attr('name'))
                })
            L_.reorderLayers(newLayersOrdered)
        }
    }

    LayersTool.orderingHistory.forEach((hist, idx) => {
        const oldIdx = hist[0]
        const newIdx = hist[1]
        const afterHeader = hist[2]
        const upward = oldIdx > newIdx
        const item = $(`#layersToolList > li:nth-child(${oldIdx + 1})`)
        sortOnStart({ item: item, oldIndex: oldIdx })
        sortOnChange({
            item: item,
            oldIndex: oldIdx,
            newIndex: newIdx + (upward ? 0 : 1),
            afterHeader: afterHeader,
        })
        sortOnEnd({
            item: item,
            oldIndex: oldIdx,
            newIndex: newIdx + (upward ? 0 : 1),
            ignoreHistory: true,
            ignoreFinalOrder: fromInit
                ? idx !== LayersTool.orderingHistory.length - 1
                : true,
        })
    })

    const listToSort = document.getElementById('layersToolList')
    Sortable.create(listToSort, {
        animation: 150,
        easing: 'cubic-bezier(0.39, 0.575, 0.565, 1)',
        handle: '.layersToolColor',
        onStart: sortOnStart,
        onChange: sortOnChange,
        onEnd: sortOnEnd,
    })

    //Start collapsed
    if (LayersTool.vars.expanded !== true)
        $('#searchLayers > #collapse').click()

    //Share everything. Don't take things that aren't yours.
    // Put things back where you found them.
    function separateFromMMGIS() {}
}

//Other functions

export default LayersTool
