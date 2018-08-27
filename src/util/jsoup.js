import {
    emptyChildrenSelectors, tableSelector, submitButtonSelector, calendarSelector,
    multivalueSelectSelector
} from './selectors';
import tableTemplate from '../script-templates/table';
import autoselectinputTemplate from '../script-templates/autoselectinput';
import { template as submitFormTemplate } from '../script-templates/submitform';
import layerTemplate from '../script-templates/layer';
import multivalueselectTemplate from '../script-templates/multivalueselect';
import functionTemplate from '../script-templates/function';
import { setOnclickAttr as setCalendarOnclickAttr } from './dataAttr';
import { setOnclickAttr as setButtonOnclickAttr } from './submitbutton';
import { themeOptions } from '../components/@oee/table';
import uglify from 'uglifyjs-browser';
import _ from 'lodash';
import { unusedTags, removeableScript, tableScript, appendableScript } from '../constants';
import { dataOnclickFunctionGenerated } from '../components/common';
import 'core-js/es6/array';
import 'core-js/es7/array';

function removeRemoveableScripts(el) {
    $(el).find(`script[class=${removeableScript}]`).remove();
    return el;
}

function alwaysTrue() {
    return true;
}

// this refers to html element
function removeTag({ name, init, filter = alwaysTrue }) {
    let data;
    init && (data = init(this));
    Array.from(this.getElementsByTagName(name))
        .filter(filter.bind(data))
        .forEach(tag => tag.parentNode.removeChild(tag));
}

function removeUnusedTags(el) {
    unusedTags.forEach(removeTag, el);
    return el;
}

function emptyChildren(el) {
    $(el).find(emptyChildrenSelectors.join(', ')).empty();
    return el;
}

function generateTableScript(el) {
    $(el).find(`script[class=${tableScript}]`).remove();
    const jsStr = Array.from($(el).find(tableSelector)).reduce((prev, element) => {
        return `${prev}
                ${tableTemplate($(element))}`;
    }, '');
    return appendScript(el, jsStr, tableScript);
}

function generateCalendarOnclickAttr(el) {
    $(el).find(calendarSelector).each(function () {
        $(this).attr('onclick') || setCalendarOnclickAttr(this);
    });
    return el;
}

function generateSelectOptionsScript(el) {
    return appendScript(el, autoselectinputTemplate());
}

function generateSubmitFormScript(el) {
    return appendScript(el, submitFormTemplate());
}

function generateButtonOnclickScript(el) {
    $(el).find(submitButtonSelector).each(function () {
        let onclick = $(this).attr('onclick');
        if (onclick) {
            if (!$(this).attr(dataOnclickFunctionGenerated)) {
                _.endsWith(onclick, ';') && (onclick = onclick.substr(0, onclick.length - 1));
                const appendableScriptElement = $(el).find(`script[class=${appendableScript}]`);
                if (appendableScriptElement.length) {
                    appendableScriptElement.html(`
                            ${appendableScriptElement.html()}
                            ${functionTemplate(onclick)}
                        `);
                } else {
                    appendScript(el, functionTemplate(onclick), appendableScript);
                }
                $(this).attr(dataOnclickFunctionGenerated, 'true');
            }
        } else {
            setButtonOnclickAttr(this);
        }
    });
    return el;
}

function concatContent(prev, cur) {
    return prev.then(prevContent =>
        cur.then(curContent => `
            ${prevContent}
            ${curContent}
        `)
    );
}

function appendScript(el, jsStr, scriptClass = removeableScript) {
    jsStr && $(`<script class="${scriptClass}"></script>`).text(jsStr).appendTo($(el).find('body'));
    return el;
}

function appendStylesheet(el, styleStr) {
    styleStr && $('<style></style>').text(styleStr).insertBefore($(el).find('body'));
    return el;
}

function constructURL(el) {
    const uri = el.tagName == 'LINK' ? 'href' : 'src';
    return new URL($(el).attr(uri), new URL($('#iframeId').attr('src'), el.baseURI)).href;
}

function getExternalContent(tag) {
    return $.ajax({
        url: constructURL(tag)
    });
}

function minify(code) {
    return uglify.minify(code, {
        compress: true,
        output: {
            beautify: false,
            indent_level: 0
        }
    }).code;
}

function getScriptContent(script) {
    if ($(script).attr('src')) {
        return getExternalContent(script);
    } else {
        return Promise.resolve($(script).text());
    }
}

function replaceWithExternalScript(el) {
    return [...$(el).find('script')]
        .map(getScriptContent)
        .reduce(concatContent, Promise.resolve(''))
        .then(content => {
            $(el).find('script').remove();
            return appendScript(el, content);
        });
}

function replaceWithExternalStylesheet(el) {
    return [...$(el).find('link[rel=stylesheet]')]
        .map(getExternalContent)
        .reduce(concatContent, Promise.resolve(''))
        .then(content => {
            $(el).find('link[rel=stylesheet]').remove();
            return appendStylesheet(el, content);
        });
}

function replaceWithExternalFiles(html) {
    const el = document.createElement('html');
    el.innerHTML = html;
    return Promise.all([replaceWithExternalStylesheet(el), replaceWithExternalScript(el)])
        .then(() => $(el).prop('outerHTML'));
}

function generateBaseTag(el, pageHref) {
    $('<base>').attr('href', `${window.location.origin}/${pageHref}`).prependTo($(el).find('head'));
    return el;
}

function generateDevDependentTags(el) {
    $(el).find('head').append('<link rel="stylesheet" href="../../../../css/drag-n-drop.css">');
    const hrefs = [...$(el).find('link[rel=stylesheet]')]
        .map(el => $(el).attr('href'));
    themeOptions.forEach(({ value }) => {
        _.find(hrefs, href => _.includes(href, value)) || $(el).find('head').append(`<link rel="stylesheet" href="../../js/plugins/ag-grid/${value}.css">`);
    });
    $(el).find('body').append('<script src="/js/interact-1.3.4.js"></script>');
    $(el).find('body').append('<script src="/dist/iframe-drag-n-drop.js"></script>');
    return el;
}

function generateLayerScript(el) {
    return appendScript(el, layerTemplate());
}

function generateMultivalueSelectScript(el) {
    return appendScript(el, multivalueselectTemplate());
}

// select multiple options, just name it as an array[]
// https://github.com/marioizquierdo/jquery.serializeJSON
function addNameBrackets(el) {
    $(el).find(multivalueSelectSelector).each(function () {
        $(this).attr('name') && $(this).attr('name', `${$(this).attr('name')}[]`);
    });
    return el;
}

function removeNameBrackets(el) {
    $(el).find(multivalueSelectSelector).each(function () {
        $(this).attr('name')
            && $(this).attr('name').endsWith('[]')
            && $(this).attr('name', $(this).attr('name').substr(0, $(this).attr('name').length - 2))
    });
    return el;
}

function htmlGenerator(html, ...fns) {
    _.startsWith(html, '<!DOCTYPE') && (html = `<!DOCTYPE html>${html}`);
    const el = document.createElement('html');
    el.innerHTML = html;
    return $(fns.reduce((el, fn) => fn(el), el)).prop('outerHTML');
}

export {
    removeUnusedTags, emptyChildren, generateTableScript, generateCalendarOnclickAttr,
    generateSelectOptionsScript, generateSubmitFormScript, generateButtonOnclickScript,
    replaceWithExternalFiles, generateBaseTag, generateDevDependentTags,
    generateLayerScript, generateMultivalueSelectScript, removeRemoveableScripts,
    addNameBrackets, removeNameBrackets, htmlGenerator
};