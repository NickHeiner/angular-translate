/**
 * @ngdoc object
 * @name pascalprecht.translate.$translateProvider
 * @description
 *
 * $translateProvider allows developers to register translation-tables, asynchronous loaders
 * and similar to configure translation behavior directly inside of a module.
 *
 */
angular.module('pascalprecht.translate').provider('$translate', ['$STORAGE_KEY', function ($STORAGE_KEY) {

  var $translationTable = {},
      $preferredLanguage,
      $availableLanguageKeys = [],
      $languageKeyAliases,
      $fallbackLanguage,
      $fallbackWasString,
      $uses,
      $nextLang,
      $storageFactory,
      $storageKey = $STORAGE_KEY,
      $storagePrefix,
      $missingTranslationHandlerFactory,
      $interpolationFactory,
      $interpolatorFactories = [],
      $interpolationSanitizationStrategy = false,
      $loaderFactory,
      $loaderOptions,
      $notFoundIndicatorLeft,
      $notFoundIndicatorRight,
      NESTED_OBJECT_DELIMITER = '.';


  // tries to determine the browsers locale
  var getLocale = function () {
    var nav = window.navigator;
    return ((
      nav.language ||
      nav.browserLanguage ||
      nav.systemLanguage ||
      nav.userLanguage
    ) || '').split('-').join('_');
  };

  var negotiateLocale = function (preferred) {

    var avail = [],
        locale = angular.lowercase(preferred),
        i = 0,
        n = $availableLanguageKeys.length;

    for (; i < n; i++) {
      avail.push(angular.lowercase($availableLanguageKeys[i]));
    }

    if (avail.indexOf(locale) > -1) {
      return locale;
    }

    if ($languageKeyAliases) {

      if ($languageKeyAliases[preferred]) {
        var alias = $languageKeyAliases[preferred];

        if (avail.indexOf(angular.lowercase(alias)) > -1) {
          return alias;
        }
      }
    }

    var parts = preferred.split('_');

    if (parts.length > 1 && avail.indexOf(angular.lowercase(parts[0])) > 1) {
      return parts[0];
    }
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#translations
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Registers a new translation table either in general or for specific language key.
   *
   * You can register a translation table just by passing an object hash where a key
   * represents a translation id and a value the concrete translation. Here is an
   * example:
   *
   * <pre>
   *  // register translation table
   *  $translateProvider.translations({
   *    'HEADLINE_TEXT':'Hey Guys, this is a headline!',
   *    'SOME_TEXT': 'A text anywhere in the app.'
   *  });
   * </pre>
   *
   * In the example above there are two registered translations,
   * HEADLINE_TEXT and SOME_TEXT.
   *
   * To register a translation table for specific language, pass a defined language
   * key as first parameter.
   *
   * <pre>
   *  // register translation table for language: 'de_DE'
   *  $translateProvider.translations('de_DE', {
   *    'GREETING': 'Hallo Welt!'
   *  });
   *
   *  // register another one
   *  $translateProvider.translations('en_US', {
   *    'GREETING': 'Hello world!'
   *  });
   * </pre>
   *
   * When registering multiple translation tables for for the same language key,
   * the actual translation table gets extended. This allows you to define module
   * specific translation which only get added, once a specific module is loaded in
   * your app.
   *
   * Invoking this method with no arguments returns the translation table which was
   * registered with no language key. Invoking it with a language key returns the
   * related translation table.
   *
   * @param {string} key A language key.
   * @param {object} translationTable A plain old JavaScript object that represents a translation table.
   *
   */
  var translations = function (langKey, translationTable) {

    if (!langKey && !translationTable) {
      return $translationTable;
    }

    if (langKey && !translationTable) {
      if (angular.isString(langKey)) {
        return $translationTable[langKey];
      } else {
        angular.extend($translationTable, flatObject(langKey));
      }
    } else {
      if (!angular.isObject($translationTable[langKey])) {
        $translationTable[langKey] = {};
      }
      angular.extend($translationTable[langKey], flatObject(translationTable));
    }
    return this;
  };

  this.translations = translations;

  /**
   * @name flatObject
   * @private
   *
   * @description
   * Flats an object. This function is used to flatten given translation data with
   * namespaces, so they are later accessible via dot notation.
   */
  var flatObject = function (data, path, result, prevKey) {
    var key, keyWithPath, val;

    if (!path) {
      path = [];
    }
    if (!result) {
      result = {};
    }
    for (key in data) {
      if (!data.hasOwnProperty(key)) continue;
      val = data[key];
      if (angular.isObject(val)) {
        flatObject(val, path.concat(key), result, key);
      } else {
        keyWithPath = path.length ? ("" + path.join(NESTED_OBJECT_DELIMITER) + NESTED_OBJECT_DELIMITER + key) : key;
        if(path.length && key === prevKey){
          // Create shortcut path (foo.bar == foo.bar.bar)
          keyWithShortPath = "" + path.join(NESTED_OBJECT_DELIMITER);
          // Link it to original path
          result[keyWithShortPath] = '@:' + keyWithPath;
        }
        result[keyWithPath] = val;
      }
    }
    return result;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#addInterpolation
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Adds interpolation services to angular-translate, so it can manage them.
   *
   * @param {object} factory Interpolation service factory
   */
  this.addInterpolation = function (factory) {
    $interpolatorFactories.push(factory);
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useMessageFormatInterpolation
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use interpolation functionality of messageformat.js.
   * This is useful when having high level pluralization and gender selection.
   */
  this.useMessageFormatInterpolation = function () {
    return this.useInterpolation('$translateMessageFormatInterpolation');
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useInterpolation
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate which interpolation style to use as default, application-wide.
   * Simply pass a factory/service name. The interpolation service has to implement
   * the correct interface.
   *
   * @param {string} factory Interpolation service name.
   */
  this.useInterpolation = function (factory) {
    $interpolationFactory = factory;
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useSanitizeStrategy
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Simply sets a sanitation strategy type.
   *
   * @param {string} value Strategy type.
   */
  this.useSanitizeValueStrategy = function (value) {
    $interpolationSanitizationStrategy = value;
    return this;
  };

 /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#preferredLanguage
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells the module which of the registered translation tables to use for translation
   * at initial startup by passing a language key. Similar to `$translateProvider#uses`
   * only that it says which language to **prefer**.
   *
   * @param {string} langKey A language key.
   *
   */
  this.preferredLanguage = function(langKey) {
    if (langKey) {
      $preferredLanguage = langKey;
      return this;
    }
    return $preferredLanguage;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#translationNotFoundIndicator
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Sets an indicator which is used when a translation isn't found. E.g. when
   * setting the indicator as 'X' and one tries to translate a translation id
   * called `NOT_FOUND`, this will result in `X NOT_FOUND X`.
   *
   * Internally this methods sets a left indicator and a right indicator using
   * `$translateProvider.translationNotFoundIndicatorLeft()` and
   * `$translateProvider.translationNotFoundIndicatorRight()`.
   *
   * **Note**: These methods automatically add a whitespace between the indicators
   * and the translation id.
   *
   * @param {string} indicator An indicator, could be any string.
   */
  this.translationNotFoundIndicator = function (indicator) {
    this.translationNotFoundIndicatorLeft(indicator);
    this.translationNotFoundIndicatorRight(indicator);
    return this;
  };

  /**
   * ngdoc function
   * @name pascalprecht.translate.$translateProvider#translationNotFoundIndicatorLeft
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Sets an indicator which is used when a translation isn't found left to the
   * translation id.
   *
   * @param {string} indicator An indicator.
   */
  this.translationNotFoundIndicatorLeft = function (indicator) {
    if (!indicator) {
      return $notFoundIndicatorLeft;
    }
    $notFoundIndicatorLeft = indicator;
    return this;
  };

  /**
   * ngdoc function
   * @name pascalprecht.translate.$translateProvider#translationNotFoundIndicatorLeft
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Sets an indicator which is used when a translation isn't found right to the
   * translation id.
   *
   * @param {string} indicator An indicator.
   */
  this.translationNotFoundIndicatorRight = function (indicator) {
    if (!indicator) {
      return $notFoundIndicatorRight;
    }
    $notFoundIndicatorRight = indicator;
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#fallbackLanguage
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells the module which of the registered translation tables to use when missing translations
   * at initial startup by passing a language key. Similar to `$translateProvider#uses`
   * only that it says which language to **fallback**.
   *
   * @param {string||array} langKey A language key.
   *
   */
  this.fallbackLanguage = function (langKey) {
    if (langKey) {
      if (angular.isString(langKey)) {
        $fallbackWasString = true;
        $fallbackLanguage = [ langKey ];
      } else if (angular.isArray(langKey)) {
        $fallbackWasString = false;
        $fallbackLanguage = langKey;
      }
      return this;
    } else {
      if ($fallbackWasString) {
        return $fallbackLanguage[0];
      } else {
        return $fallbackLanguage;
      }
    }
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#uses
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Set which translation table to use for translation by given language key. When
   * trying to 'use' a language which isn't provided, it'll throw an error.
   *
   * You actually don't have to use this method since `$translateProvider#preferredLanguage`
   * does the job too.
   *
   * @param {string} langKey A language key.
   */
  this.uses = function (langKey) {
    if (langKey) {
      if (!$translationTable[langKey] && (!$loaderFactory)) {
        // only throw an error, when not loading translation data asynchronously
        throw new Error("$translateProvider couldn't find translationTable for langKey: '" + langKey + "'");
      }
      $uses = langKey;
      return this;
    }
    return $uses;
  };

 /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#storageKey
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells the module which key must represent the choosed language by a user in the storage.
   *
   * @param {string} key A key for the storage.
   */
  var storageKey = function(key) {
    if (!key) {
      if ($storagePrefix) {
        return $storagePrefix + $storageKey;
      }
      return $storageKey;
    }
    $storageKey = key;
  };

  this.storageKey = storageKey;

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useUrlLoader
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use `$translateUrlLoader` extension service as loader.
   *
   * @param {string} url Url
   */
  this.useUrlLoader = function (url) {
    return this.useLoader('$translateUrlLoader', { url: url });
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useStaticFilesLoader
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use `$translateStaticFilesLoader` extension service as loader.
   *
   * @param {Object=} options Optional configuration object
   */
  this.useStaticFilesLoader = function (options) {
    return this.useLoader('$translateStaticFilesLoader', options);
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useLoader
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use any other service as loader.
   *
   * @param {string} loaderFactory Factory name to use
   * @param {Object=} options Optional configuration object
   */
  this.useLoader = function (loaderFactory, options) {
    $loaderFactory = loaderFactory;
    $loaderOptions = options || {};
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useLocalStorage
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use `$translateLocalStorage` service as storage layer.
   *
   */
  this.useLocalStorage = function () {
    return this.useStorage('$translateLocalStorage');
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useCookieStorage
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use `$translateCookieStorage` service as storage layer.
   */
  this.useCookieStorage = function () {
    return this.useStorage('$translateCookieStorage');
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useStorage
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use custom service as storage layer.
   */
  this.useStorage = function (storageFactory) {
    $storageFactory = storageFactory;
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#storagePrefix
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Sets prefix for storage key.
   *
   * @param {string} prefix Storage key prefix
   */
  this.storagePrefix = function (prefix) {
    if (!prefix) {
      return prefix;
    }
    $storagePrefix = prefix;
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useMissingTranslationHandlerLog
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to use built-in log handler when trying to translate
   * a translation Id which doesn't exist.
   *
   * This is actually a shortcut method for `useMissingTranslationHandler()`.
   *
   */
  this.useMissingTranslationHandlerLog = function () {
    return this.useMissingTranslationHandler('$translateMissingTranslationHandlerLog');
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#useMissingTranslationHandler
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Expects a factory name which later gets instantiated with `$injector`.
   * This method can be used to tell angular-translate to use a custom
   * missingTranslationHandler. Just build a factory which returns a function
   * and expects a translation id as argument.
   *
   * Example:
   * <pre>
   *  app.config(function ($translateProvider) {
   *    $translateProvider.useMissingTranslationHandler('customHandler');
   *  });
   *
   *  app.factory('customHandler', function (dep1, dep2) {
   *    return function (translationId) {
   *      // something with translationId and dep1 and dep2
   *    };
   *  });
   * </pre>
   *
   * @param {string} factory Factory name
   */
  this.useMissingTranslationHandler = function (factory) {
    $missingTranslationHandlerFactory = factory;
    return this;
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#determinePreferredLanguage
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Tells angular-translate to try to determine on its own which language key
   * to set as preferred language. When `fn` is given, angular-translate uses it
   * to determine a language key, otherwise it uses the built-in `getLocale()`
   * method.
   *
   * The `getLocale()` returns a language key in the format `[lang]_[country]` or
   * `[lang]` depending on what the browser provides.
   *
   * Use this method at your own risk, since not all browsers return a valid
   * locale.
   *
   * @param {object=} fn Function to determine a browser's locale
   */
  this.determinePreferredLanguage = function (fn) {

    var locale = (fn && angular.isFunction(fn)) ? fn() : getLocale();

    if (!$availableLanguageKeys.length) {
      $preferredLanguage = locale;
      return this;
    } else {
      $preferredLanguage = negotiateLocale(locale);
    }
  };

  /**
   * @ngdoc function
   * @name pascalprecht.translate.$translateProvider#registerAvailableLanguageKeys
   * @methodOf pascalprecht.translate.$translateProvider
   *
   * @description
   * Registers a set of language keys the app will work with. Use this method in
   * combination with
   * {@link pascalprecht.translate.$translateProvider#determinePreferredLanguage determinePreferredLanguage}.
   * When available languages keys are registered, angular-translate
   * tries to find the best fitting language key depending on the browsers locale,
   * considering your language key convention.
   *
   * @param {object} languageKeys Array of language keys the your app will use
   * @param {object=} aliases Alias map.
   */
  this.registerAvailableLanguageKeys = function (languageKeys, aliases) {
    if (languageKeys) {
      $availableLanguageKeys = languageKeys;
      if (aliases) {
        $languageKeyAliases = aliases;
      }
      return this;
    }
    return $availableLanguageKeys;
  };

  /**
   * @ngdoc object
   * @name pascalprecht.translate.$translate
   * @requires $interpolate
   * @requires $log
   * @requires $rootScope
   * @requires $q
   *
   * @description
   * The `$translate` service is the actual core of angular-translate. It expects a translation id
   * and optional interpolate parameters to translate contents.
   *
   * <pre>
   *  $scope.translatedText = $translate('HEADLINE_TEXT');
   * </pre>
   *
   * @param {string} translationId A token which represents a translation id
   * @param {object=} interpolateParams An object hash for dynamic values
   */
  this.$get = [
    '$log',
    '$injector',
    '$rootScope',
    '$q',
    function ($log, $injector, $rootScope, $q) {

      var Storage,
          defaultInterpolator = $injector.get($interpolationFactory || '$translateDefaultInterpolation'),
          pendingLoader = false,
          interpolatorHashMap = {},
          loaderFetchTable;

      /**
       * @name indexOf
       * @private
       *
       * @description
       * indexOf polyfill. Kinda sorta.
       *
       * @param {array} array Array to search in.
       * @param {string} searchElement Element to search for.
       *
       * @returns {int} Index of search element.
       */
      var indexOf = function(array, searchElement) {
        for (var i = 0, len = array.length; i < len; i++) {
          if (array[i] === searchElement) {
            return i;
          }
        }
        return -1;
      };

      // get an index in the $fallbackLanguage array from which we can to apply fallbacks
      var getStartFallbackIndex = function(usesLang) {
        return indexOf($fallbackLanguage, usesLang) + 1;
      };

      /**
       * @name applyNotFoundIndicators
       * @private
       *
       * @description
       * Applies not fount indicators to given translation id, if needed.
       * This function gets only executed, if a translation id doesn't exist,
       * which is why a translation id is expected as argument.
       *
       * @param {string} translationId Translation id.
       * @returns {string} Same as given translation id but applied with not found
       * indicators.
       */
      var applyNotFoundIndicators = function (translationId) {
        // applying notFoundIndicators
        if ($notFoundIndicatorLeft) {
          translationId = [$notFoundIndicatorLeft, translationId].join(' ');
        }
        if ($notFoundIndicatorRight) {
          translationId = [translationId, $notFoundIndicatorRight].join(' ');
        }
        return translationId;
      };

      /**
       * @name useLanguage
       * @private
       *
       * @description
       * Makes actual use of a language by setting a given language key as used
       * language and informs registered interpolators to also use the given
       * key as locale.
       *
       * @param {key} Locale key.
       */
      var useLanguage = function (key) {
        $uses = key;
        $rootScope.$emit('$translateChangeSuccess');

        if ($storageFactory) {
          Storage.set($translate.storageKey(), $uses);
        }
        // inform default interpolator
        defaultInterpolator.setLocale($uses);
        // inform all others to!
        angular.forEach(interpolatorHashMap, function (interpolator, id) {
          interpolatorHashMap[id].setLocale($uses);
        });
        $rootScope.$emit('$translateChangeEnd');
      };

      /**
       * @name loadAsync
       * @private
       *
       * @description
       * Kicks of registered async loader using `$injector` and applies existing
       * loader options. When resolved, it updates translation tables accordingly
       * or rejects with given language key.
       *
       * @param {string} key Language key.
       * @return {Promise} A promise.
       */
      var loadAsync = function (key) {
        if (!key) {
          throw "No language key specified for loading.";
        }

        var deferred = $q.defer();

        $rootScope.$emit('$translateLoadingStart');
        pendingLoader = true;

        $injector.get($loaderFactory)(angular.extend($loaderOptions, {
          key: key
        })).then(function (data) {
          var translationTable = {};
          $rootScope.$emit('$translateLoadingSuccess');

          if (angular.isArray(data)) {
            angular.forEach(data, function (table) {
              angular.extend(translationTable, table);
            });
          } else {
            angular.extend(translationTable, data);
          }
          pendingLoader = false;
          deferred.resolve({
            key: key,
            table: translationTable
          });
          $rootScope.$emit('$translateLoadingEnd');
        }, function (key) {
          $rootScope.$emit('$translateLoadingError');
          deferred.reject(key);
          $rootScope.$emit('$translateLoadingEnd');
        });
        return deferred.promise;
      };

      if ($storageFactory) {
        Storage = $injector.get($storageFactory);

        if (!Storage.get || !Storage.set) {
          throw new Error('Couldn\'t use storage \'' + $storageFactory + '\', missing get() or set() method!');
        }
      }

      // apply additional settings
      if (angular.isFunction(defaultInterpolator.useSanitizeValueStrategy)) {
        defaultInterpolator.useSanitizeValueStrategy($interpolationSanitizationStrategy);
      }

      // if we have additional interpolations that were added via
      // $translateProvider.addInterpolation(), we have to map'em
      if ($interpolatorFactories.length) {
        angular.forEach($interpolatorFactories, function (interpolatorFactory) {
          var interpolator = $injector.get(interpolatorFactory);
          // setting initial locale for each interpolation service
          interpolator.setLocale($preferredLanguage || $uses);
          // apply additional settings
          if (angular.isFunction(interpolator.useSanitizeValueStrategy)) {
            interpolator.useSanitizeValueStrategy($interpolationSanitizationStrategy);
          }
          // make'em recognizable through id
          interpolatorHashMap[interpolator.getInterpolationIdentifier()] = interpolator;
        });
      }

      var fallbackTranslation = function (translationId, interpolateParams, Interpolator) {

        var deferred = $q.defer(),
            i = 0,
            len = $fallbackLanguage.length,
            translationFound = false;

        for (; i < len; i++) {
          var langKey = $fallbackLanguage[i];

          if ($translationTable.hasOwnProperty(langKey)) {

            var translation = $translationTable[langKey][translationId];

            // check if a translation for the fallback language exists
            if (translation) {
              translationFound = true;
              // temporarly letting Interpolator know we're using fallback language now.
              Interpolator.setLocale($fallbackLanguage[i]);
              translation = Interpolator.interpolate(translation, interpolateParams);
              // after we've interpolated the translation, we reset Interpolator to proper locale.
              Interpolator.setLocale($uses);
              deferred.resolve(translation);
            }
          } else {
            if ($loaderFactory) {
              loadAsync(langKey).then(function (data) {
                translations(langKey, data.table);
                if ($translationTable[langKey][translationId]) {
                  translationFound = true;
                  // temporarly letting Interpolator know we're using fallback language now.
                  Interpolator.setLocale($fallbackLanguage[i]);
                  translation = Interpolator.interpolate(translation, interpolateParams);
                  // after we've interpolated the translation, we reset Interpolator to proper locale.
                  Interpolator.setLocale($uses);
                }
              }, function () {
                console.log('loading failed'); 
              });
            }
          }
        }

        if (!translationFound) {
          deferred.reject(translationId);
        }
        return deferred.promise;
      };

      var determineTranslation = function (translationId, interpolateParams, interpolationId) {

        var deferred = $q.defer();

        var table = $uses ? $translationTable[$uses] : $translationTable,
            Interpolator = (interpolationId) ? interpolatorHashMap[interpolationId] : defaultInterpolator;

        // if the translation id exists, we can just interpolate it
        if (table && table.hasOwnProperty(translationId)) {
          var translation = table[translationId];

          // If using link, rerun $translate with linked translationId and return it
          if (translation.substr(0, 2) === '@:') {

            $translate(translation.substr(2), interpolateParams, interpolationId)
              .then(function (_translation) {
                deferred.resolve(_translation);
              }, function () {
                deferred.reject(_translation);
              });
          } else {
            deferred.resolve(Interpolator.interpolate(translation, interpolateParams));
          }
        } else {
          // looks like the requested translation id doesn't exists.
          // Now, if there is a registered handler for missing translations and no
          // asyncLoader is pending, we execute the handler
          if ($missingTranslationHandlerFactory && !pendingLoader) {
            $injector.get($missingTranslationHandlerFactory)(translationId, $uses);
          }

          // since we couldn't translate the inital requested translation id,
          // we try it now with one or more fallback languages, if fallback language(s) is
          // configured.
          if ($uses && $fallbackLanguage.length) {
            fallbackTranslation(translationId, interpolateParams, Interpolator)
              .then(function (translation) {
                deferred.resolve(translation);
              }, function (_translationId) {
                deferred.reject(applyNotFoundIndicators(_translationId));
              });

          } else {
            deferred.reject(applyNotFoundIndicators(translationId));
          }
        }
        return deferred.promise;
      };

      var $translate = function (translationId, interpolateParams, interpolationId) {

        var deferred = $q.defer();
        // trim off any whitespace
        translationId = translationId.trim();

        if (!loaderFetchTable) {
          determineTranslation(translationId, interpolateParams, interpolationId).then(function (translation) {
            deferred.resolve(translation);
          }, function (translationId) {
            deferred.reject(translationId);
          });
        } else {
          loaderFetchTable.then(function () {
            determineTranslation(translationId, interpolateParams, interpolationId).then(function (translation) {
              deferred.resolve(translation);
            }, function (translationId) {
              deferred.reject(translationId);
            });
          });
        }
        return deferred.promise;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#preferredLanguage
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns the language key for the preferred language.
       *
       * @return {string} preferred language key
       */
      $translate.preferredLanguage = function () {
        return $preferredLanguage;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#fallbackLanguage
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns the language key for the fallback languages.
       *
       * @return {string||array} fallback language key
       */
      $translate.fallbackLanguage = function () {
        if ($fallbackWasString) {
          return $fallbackLanguage[0];
        } else {
          return $fallbackLanguage;
        }
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#proposedLanguage
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns the language key of language that is currently loaded asynchronously.
       *
       * @return {string} language key
       */
      $translate.proposedLanguage = function () {
        return $nextLang;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#storage
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns registered storage.
       *
       * @return {object} Storage
       */
      $translate.storage = function () {
        return Storage;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#uses
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Tells angular-translate which language to uses by given language key. This method is
       * used to change language at runtime. It also takes care of storing the language
       * key in a configured store to let your app remember the choosed language.
       *
       * When trying to 'use' a language which isn't available it tries to load it
       * asynchronously with registered loaders.
       *
       * Returns promise object with loaded language file data
       * @example
       * $translate.uses("en_US").then(function(data){
       *   $scope.text = $translate("HELLO");
       * });
       *
       * @param {string} key Language key
       * @return {string} Language key
       */
      $translate.uses = function (key) {
        if (!key) {
          return $uses;
        }

        var deferred = $q.defer();

        $rootScope.$emit('$translateChangeStart');

        // if there isn't a translation table for the language we've requested,
        // we load it asynchronously
        if (!$translationTable[key] && $loaderFactory) {
          $nextLang = key;
          loaderFetchTable = loadAsync(key).then(
            function (translation) {
              $nextLang = undefined;
              translations(translation.key, translation.table);
              deferred.resolve(key);
              useLanguage(translation.key);
            }, function (key) {
              $nextLang = undefined;
              $rootScope.$emit('$translateChangeError');
              deferred.reject(key);
              $rootScope.$emit('$translateChangeEnd');
            }
          );
        } else {
          deferred.resolve(key);
          useLanguage(key);
        }

        return deferred.promise;
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#storageKey
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Returns the key for the storage.
       *
       * @return {string} storage key
       */
      $translate.storageKey = function () {
        return storageKey();
      };

      /**
       * @ngdoc function
       * @name pascalprecht.translate.$translate#refresh
       * @methodOf pascalprecht.translate.$translate
       *
       * @description
       * Refreshes a translation table pointed by the given langKey. If langKey is not specified,
       * the module will drop all existent translation tables and load new version of those which
       * are currently in use.
       *
       * Refresh means that the module will drop target translation table and try to load it again.
       *
       * In case there are no loaders registered the refresh() method will throw an Error.
       *
       * If the module is able to refresh translation tables refresh() method will broadcast
       * $translateRefreshStart and $translateRefreshEnd events.
       *
       * @example
       * // this will drop all currently existent translation tables and reload those which are
       * // currently in use
       * $translate.refresh();
       * // this will refresh a translation table for the en_US language
       * $translate.refresh('en_US');
       *
       * @param {string} lankKey A language key of the table, which has to be refreshed
       *
       * @return {promise} Promise, which will be resolved in case a translation tables refreshing
       * process is finished successfully, and reject if not.
       */
      $translate.refresh = function (langKey) {
        if (!$loaderFactory) {
          throw new Error('Couldn\'t refresh translation table, no loader registered!');
        }

        var deferred = $q.defer();

        function onLoadSuccess() {
          deferred.resolve();
          $rootScope.$emit('$translateRefreshEnd');
        }

        function onLoadFailure() {
          deferred.reject();
          $rootScope.$emit('$translateRefreshEnd');
        }

        if (!langKey) {

          $rootScope.$emit('$translateRefreshStart');

          var loaders = [];
          if ($fallbackLanguage && $fallbackLanguage.length) {
            var fallbackLanguagesSize = $fallbackLanguage.length;
            for (var current = 0; current < fallbackLanguagesSize; current++) {
              loaders.push(loadAsync($fallbackLanguage[current]));
            }
          }

          if ($uses) {
            loaders.push(loadAsync($uses));
          }

          if (loaders.length > 0) {
            $q.all(loaders).then(
              function (newTranslations) {
                for (var lang in $translationTable) {
                  if ($translationTable.hasOwnProperty(lang)) {
                    delete $translationTable[lang];
                  }
                }
                for (var i = 0, len = newTranslations.length; i < len; i++) {
                  translations(newTranslations[i].key, newTranslations[i].table);
                }
                if ($uses) {
                  $translate.uses($uses);
                }
                onLoadSuccess();
              },
              function (key) {
                if (key === $uses) {
                  $rootScope.$emit('$translateChangeError');
                }
                onLoadFailure();
              }
            );
          } else onLoadSuccess();

        } else if ($translationTable.hasOwnProperty(langKey)) {

          $rootScope.$emit('$translateRefreshStart');

          var loader = loadAsync(langKey);
          if (langKey === $uses) {
            loader.then(
              function (newTranslation) {
                $translationTable[langKey] = newTranslation.table;
                $translate.uses($uses);
                onLoadSuccess();
              },
              function () {
                $rootScope.$emit('$translateChangeError');
                onLoadFailure();
              }
            );
          } else {
            loader.then(
              function (newTranslation) {
                $translationTable[langKey] = newTranslation.table;
                onLoadSuccess();
              },
              onLoadFailure
            );
          }

        } else deferred.reject();

        return deferred.promise;
      };

      // If at least one async loader is defined and there are no (default) translations available
      // we should try to load them.
      if ($loaderFactory) {
        if (angular.equals($translationTable, {})) {
          $translate.uses($translate.uses());
        }

        /*if ($fallbackLanguage && $fallbackLanguage.length) {
          var loaders = [],
              failedKeys = [];

          var fallbackLoadSuccess = function(fallbackTranslation) {
            translations(fallbackTranslation.key, fallbackTranslation.table);
          };

          var fallbackLoadFail = function(failKkey) {
            failedKeys.push(failKkey);
          };

          var fallbacksCleanup = function() {
            if (failedKeys.length) {
              // Remove all fallback languages which were not loaded.
              // Also we need to keep the order of elements in $fallbackLanguage
              var newFallbacks = [];
              for (var i = 0, len = $fallbackLanguage.length; i < len; i++) {
                if (indexOf(failedKeys, $fallbackLanguage[i]) === -1) {
                  newFallbacks.push($fallbackLanguage[i]);
                }
              }
              $fallbackLanguage = newFallbacks;
            }
          };

          for (var i = 0, len = $fallbackLanguage.length; i < len; i++) {
            if (!$translationTable[$fallbackLanguage[i]]) {
              loaders.push(
                loadAsync($fallbackLanguage[i])
                  .then(fallbackLoadSuccess, fallbackLoadFail)
              );
            }
          }

          $q.all(loaders).then(fallbacksCleanup, fallbacksCleanup);
        }*/
      }

      return $translate;
    }];
}]);