// Gulp.js configuration
const
    // modules
    gulp = require('gulp'),
    argv = require('yargs').argv,
    spawn = require('child_process').spawn,
    newer = require('gulp-newer'),
    sass = require('gulp-sass'),
    imagemin = require('gulp-imagemin'),
    imageminJpegRecompress = require('imagemin-jpeg-recompress'),
    imageminPngQuant = require('imagemin-pngquant'),
    concat = require('gulp-concat'),
    postcss = require('gulp-postcss'),
    postcssPreset = require('postcss-preset-env'),
    autoprefixer = require('autoprefixer'),
    cssnano = require('cssnano'),
    purgecss = require('gulp-purgecss'),
    uglify = require('gulp-uglify-es').default,
    browserify = require('browserify'),
    babelify = require('babelify'),
    vsource = require('vinyl-source-stream'),
    vbuffer = require('vinyl-buffer'),
    browserSync = require('browser-sync').create(),
    deporder = require('gulp-deporder'),
    merge = require('merge-stream'),
    del = require('del'),
    sourcemaps = require('gulp-sourcemaps'),
    nunjucksRender = require('gulp-nunjucks-render'),
    cachebust = require('gulp-cache-bust'),
    replace = require('gulp-replace'),

    // development mode?
    devBuild = (process.env.NODE_ENV !== 'production'),
    // folders
    folder = {
        src: 'src/',
        dist: 'dist/',
        local: 'local/'
    };

// JavaScript processing
gulp.task('js', function (cb) {

    return browserify({
            entries: folder.src + 'assets/js/main.js',
            debug: true
        })
        .transform(babelify)
        .bundle()
        .on('error', err => {
            console.log(err.message);
            cb();
        })
        .pipe(vsource('build.min.js'))
        .pipe(vbuffer())
        .pipe(sourcemaps.init())
        .pipe(uglify())
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(folder.local + 'assets/js/'));

});

// image processing
gulp.task('images', function () {

    var dest = folder.local + 'assets/img/';

    return gulp.src(folder.src + 'assets/img/**/*.+(png|jpg|jpeg|gif|svg)')
        .pipe(newer(dest)) // only if it's a new or updated image
        .pipe(imagemin([
            imagemin.gifsicle(),
            imageminJpegRecompress({
                loops: 6,
                min: 65,
                max: 90,
                quality: 'low'
            }),
            imageminPngQuant(),
            imagemin.svgo()
        ]))
        .pipe(gulp.dest(dest));

});

// combine css and sass processing
gulp.task('sass+css', gulp.series('images', function () {

    var postcssPlugins = [autoprefixer, cssnano, postcssPreset];

    var _cssStream = gulp.src(folder.src + 'assets/css/**/*.css')
        .pipe(sourcemaps.init())
        .pipe(deporder())
    // .pipe( cleancss(  { level: { 1: { specialComments: 0 } } }  ) );

    var _sassStream = gulp.src(folder.src + 'assets/scss/**/*.scss')
        .pipe(sourcemaps.init())
        .pipe(sass({
            outputStyle: 'compressed',
            sourceMap: true,
            includePaths: ['node_modules']
        }).on('error', sass.logError));

    return merge(_sassStream, _cssStream)
        // the order of the following plugins really matters( 1. process the css 2. remove unwanted stuff 3. concatenate)
        .pipe(postcss(postcssPlugins))
        .pipe(purgecss({
            content: [folder.local + 'assets/js/**/*.js', folder.local + '**/*.html'],
            whitelist: ['site-header', 'compact-header', 'no-header', 'full-height-header', 'grid-item--3', 'grid-item--2', 'grid-item']
        }))
        .pipe(concat('build.min.css'))
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(folder.local + 'assets/css/'))
        .pipe(browserSync.reload({
            stream: true
        }));

}));

// nunjucks
gulp.task('nunjucks', function () {

    return gulp.src(folder.src + 'pages/**/*.+(html|nunjucks|njk)')
        // Renders template with nunjucks
        .pipe(nunjucksRender({
            path: [folder.src + 'templates']
        })).pipe(gulp.dest(folder.local));

});

// browser-sync
gulp.task('browser-sync', function (cb) {

    browserSync.init({
        server: {
            baseDir: folder.local,
            directory: false,
            index: 'index.html'
        },
        files: [folder.local + "*.html", folder.local + "assets/**/*.css", folder.local + "assets/**/*.js"],
        open: false
    }, cb);

});

// clean "assets" directory
gulp.task('clean:assets', function () {
    return del(folder.local + 'assets');
});

// clean "dist" directory
gulp.task('clean:dist', function () {
    return del(folder.dist + '**/*');
});

// clean "local" directory
gulp.task('clean:local', function () {
    return del(folder.local + '**/*');
});

// clean "html" files
gulp.task('clean:html', function () {
    return del(folder.local + '*.html');
});

// cachebust
gulp.task('html', function (cb) {
    cb();
    //return gulp;
    return gulp.src(folder.local + '**/*.html')
        .pipe(gulp.dest(folder.local));

});

// copy
gulp.task('copy', function () {

    //   return gulp.src([folder.src + 'assets/fonts/**/*', 'node_modules/@fortawesome/fontawesome-free/webfonts/**/*'])
    return gulp.src([folder.src + 'assets/fonts/**/*'])
        .pipe(gulp.dest(folder.local + "assets/fonts"));

});

// copy
gulp.task('copy:to-dist', function (cb) {

    // copy assets
    gulp.src(folder.local + 'assets/**/*')
        .pipe(gulp.dest(folder.dist + 'assets/'));
    
    // copy html files
    gulp.src( folder.local + '*.html')
        .pipe( replace( '@@date', new Date() ) )
        .pipe( cachebust({
            type: 'timestamp'
        }) )
        .pipe( gulp.dest( folder.dist ) );

    cb();

});

// watch changes to gulpfile.js
gulp.task('auto-reload', function () {

    var p;

    gulp.watch('gulpfile.js', spawnChildren);
    spawnChildren();

    function spawnChildren(e) {
        // kill previous spawned process
        if (p) {
            p.kill();
        }

        // `spawn` a child `gulp` process linked to the parent `stdio`
        p = spawn('gulp', [argv.task], {
            stdio: 'inherit'
        });
    }

});

// watch for changes
gulp.task('watch', function () {

    // image changes
    gulp.watch(folder.src + 'assets/img/**/*', gulp.parallel('images'));

    // html changes
    // gulp.watch(folder.src + 'html/**/*', ['html']);

    // nunjuck changes
    gulp.watch(folder.src + 'pages/**/*', gulp.parallel('nunjucks', 'sass+css'));
    gulp.watch(folder.src + 'templates/**/*', gulp.parallel('nunjucks', 'sass+css'));

    // javascript changes
    gulp.watch(folder.src + 'assets/js/**/*.js', gulp.series('js', 'html'));

    // css changes
    // gulp.watch(folder.src + 'assets/css/**/*.css', ['css']);
    gulp.watch(folder.src + 'assets/css/**/*.css', gulp.series('sass+css'));

    // watch for sass changes
    // gulp.watch(folder.src + 'assets/scss/**/*', ['sass']);
    gulp.watch(folder.src + 'assets/scss/**/*.scss', gulp.series('sass+css'));

    // watch for changes to HTML in output folder
    gulp.watch(folder.dist + "**/*.html").on('all', browserSync.reload);

});

// building for testing server locally
gulp.task('dev', gulp.series('clean:local', 'clean:html', 'clean:assets', 'nunjucks', 'js', 'sass+css', 'copy', 'html', 'browser-sync', 'watch'));

// deploy for production
gulp.task('build', gulp.series('clean:dist', 'nunjucks', 'js', 'sass+css', 'copy', 'html', 'copy:to-dist'));

gulp.task('default', gulp.series('dev'));