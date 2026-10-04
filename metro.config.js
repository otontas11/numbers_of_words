const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('lottie');
// Köprü kurtarma sahnesi tek dosyalık HTML olarak paketlenir (WebView, çevrimdışı).
config.resolver.assetExts.push('html');

module.exports = config;
