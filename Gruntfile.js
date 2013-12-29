
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
      ios7icons: {
        files: [
            {
                src: [
                    "*"
                ],
                dest: "platforms/ios/Make Me Cash/Resources/icons",
                cwd: "assets/ios",
                expand: true
            },
            {
                src: [
                    "*"
                ],
                dest: "platforms/ios/Make Me Cash/Resources/icons",
                cwd: "assets/ios7",
                expand: true
            }
        ]
      },
      androidicons: {
        files: [
            {
                src: [
                    "**/*.png", "!playstore-icon.png", "!**/screen.png"
                ],
                dest: "platforms/android/res",
                cwd: "assets/android",
                expand: true
            }
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
          wrap: true,
          //optimize: 'none'
        }
      }
    },

    cssmin: {
      combine: {
        files: {
            'merges/ios/css/output.css': ['www-dev/css/bootstrap-glyphicons.css',
                                       'www-dev/js/bower_components/chocolatechip-ui/chui/chui.ios-3.0.7.css',
                                       'www-dev/css/index.css',
                                       'www-dev/css/ios.css'
            ],
            'merges/android/css/output.css': ['www-dev/css/bootstrap-glyphicons.css',
                                       'www-dev/js/bower_components/chocolatechip-ui/chui/chui.android-3.0.7.css',
                                       'www-dev/css/index.css',
                                       'www-dev/css/android.css'
            ]
        }
      },
      minifyios: {
        expand: true,
        cwd: 'merges/ios/css',
        src: ['output.css'],
        dest: 'merges/ios/css/',
        ext: '.min.css'
      },
      minifyandroid: {
        expand: true,
        cwd: 'merges/android/css',
        src: ['output.css'],
        dest: 'merges/android/css/',
        ext: '.min.css'
      }
    },

    cordovacli: {
        options: {
            path: '.'
        },
        prepareios: {
            options: {
                command: 'prepare',
                platforms: ['ios']
            }
        },
        prepareandroid: {
            options: {
                command: 'prepare',
                platforms: ['android']
            }
        },
        compileandroid: {
            options: {
                command: 'compile',
                platforms: ['android']
            }
        }
    },

    autoshot: {
        ios7: {
          options: {
            path: 'platforms/ios/Make Me Cash/Resources/splash',
            local: {
              path: 'www-dev',
              port: 26380,
              files: [
                { src: 'ios7-splashscreen.html', dest: 'Default~iphone.png' }
              ]
            },
            viewport: ['320x480', '640x960', '640x1136']
          }
        }
      },

      rename: {
        iphonesplash: {
          src: 'platforms/ios/Make Me Cash/Resources/splash/local-320x480-Default~iphone.png',
          dest: 'platforms/ios/Make Me Cash/Resources/splash/Default~iphone.png'
        },
        iphonex2splash: {
          src: 'platforms/ios/Make Me Cash/Resources/splash/local-640x960-Default~iphone.png',
          dest: 'platforms/ios/Make Me Cash/Resources/splash/Default@2x~iphone.png'
        },
        iphone5splash: {
          src: 'platforms/ios/Make Me Cash/Resources/splash/local-640x1136-Default~iphone.png',
          dest: 'platforms/ios/Make Me Cash/Resources/splash/Default-568h@2x~iphone.png'
        }
      }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-cordovacli');
  grunt.loadNpmTasks('grunt-autoshot');
  grunt.loadNpmTasks('grunt-rename');

  grunt.registerTask('splash', ['autoshot:ios7', 'rename:iphonesplash', 'rename:iphonex2splash', 'rename:iphone5splash']);
  // Default task(s).
  grunt.registerTask('ios', ['clean', 'requirejs', 'cssmin:combine', 'cssmin:minifyios', 'copy:main', 'copy:ios7icons', 'cordovacli:prepareios', 'splash']);
  grunt.registerTask('android', ['clean', 'requirejs', 'cssmin:combine', 'cssmin:minifyandroid', 'copy:main', 'copy:androidicons', 'cordovacli:prepareandroid', 'cordovacli:compileandroid']);

  grunt.registerTask('default', ['clean', 'requirejs', 'cssmin:combine', 'cssmin:minifyios', 'cssmin:minifyandroid', 'copy:main', 'copy:ios7icons', 'copy:androidicons', 'cordovacli:prepareios', 'cordovacli:prepareandroid',  'cordovacli:compileandroid', 'splash']);

};