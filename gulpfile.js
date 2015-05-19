var gulp = require('gulp');

// jshint
var stylish = require('jshint-stylish');
var jshint = require('gulp-jshint');

// jasmine
var jasmine = require('gulp-jasmine');

gulp.task('lint', function() {
	var options = {
    "esnext" : true,
    "expr" : true,
    "sub" : true
  };
  return gulp.src('./src/**/*.js')
    .pipe(jshint(options))
    .pipe(jshint.reporter(stylish));
});

gulp.task('test', function () {
    return gulp.src('./spec/**/*.spec.js')
        .pipe(jasmine());
});

gulp.task('default', ['lint','test']);
