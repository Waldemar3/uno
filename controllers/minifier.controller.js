const postcss = require('postcss')
const cssnano = require('cssnano')
const autoprefixer = require('autoprefixer')
const babel = require("@babel/core");
const fs = require('fs');

module.exports = {
  js: function(index, dir, output, uniqueFiles = []){
    fs.writeFileSync(output, babel.transformSync(uniqueFiles.join('')+this.mergeFiles(dir, index)+fs.readFileSync(dir+'/'+index, 'utf8'), {presets: ["minify"], comments: false}).code);
  },
  css: function(dir, output){
    postcss([cssnano, autoprefixer]).process(this.mergeFiles(dir)).then(({css})=>fs.writeFileSync(output, css));
  },
  templates: function(dir){
    return 'const Templates = {'+this.mergeTemaplates(dir)+'};';
  },
  mergeTemaplates: function(dir){
    let templates = [];

    fs.readdirSync(dir).forEach(source => {
      const [sourcename, pathname] = source.split('.');

      if(pathname) {
        templates.push(`${sourcename}:'${fs.readFileSync(dir+'/'+source, 'utf8').replace(/\s+/g, ' ')}'`);
        return;
      }
      templates = templates.concat(this.mergeTemaplates(dir+'/'+source));
    });

    return templates;
  },
  mergeFiles: function(dir, index){
    return fs.readdirSync(dir).map(source => {
      if(source === index) return;

      const [sourcename, pathname] = source.split('.');
      return pathname ? fs.readFileSync(dir+'/'+source, 'utf8') : this.mergeFiles(dir+'/'+sourcename);
    }).join('');
  },
}
