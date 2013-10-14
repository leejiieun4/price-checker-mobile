module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    copy: {
      main: {
        files: [
          {
            src: [
                '*.xml',
                'index.html',
                'res/*',
                'fonts/*',
                'img/*',
                'img/**/*',
                'js/optimized.js'
            ],
            dest: 'www/',
            cwd: 'www-dev',
            expand: true
          },
        ]
      },
      options: {
        processContentExclude: ["**/*.{gif,jpg,png}"],
        processContent: function (content, filePath) {
          if (/index.html/.test(filePath)) {
              // remove the original require script
              content = content.replace(/<script.*require.js"><\/script>/, "<script type=\"text/javascript\" src=\"js/optimized.js\"></script>");
              // now update the css location
              content = content.replace(/<link.*><\/link>/g, "");
              content = content.replace(/<\/title>/, "</title>\n<link type=\"text/css\" rel=\"stylesheet\" href=\"css/output.min.css\"></link>");
          }
          return content;
        }
      }
    },

    clean: {
        main: ['www/*']
    },

    requirejs: {
      compile: {
        options: {
          baseUrl: 'www-dev/js',
          include: ['bower_components/almond/almond.js', 'priceCheckerApp.js'],
          mainConfigFile: "www-dev/js/main.js",
          out: "www-dev/js/optimized.js",
          findNestedDependencies: true,
          wrap: true
        }
      }
    },

    cssmin: {
      combine: {
        files: {
            'www-dev/css/output.css': ['www-dev/css/bootstrap-glyphicons.css',
            'www-dev/js/bower_components/chocolatechip-ui/chui/chui.ios-3.0.4.min.css',
            'www-dev/css/index.css']
        }
      },
      minify: {
        expand: true,
        cwd: 'www-dev',
        src: ['css/output.css'],
        dest: 'www',
        ext: '.min.css'
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-contrib-cssmin');


  // Default task(s).
  grunt.registerTask('default', ['clean', 'requirejs', 'cssmin:combine', 'cssmin:minify', 'copy']);

};