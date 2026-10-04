// Polyfills must load BEFORE any Solana code, or signing fails before the
// wallet is ever reached.
import 'react-native-get-random-values';
import {Buffer} from 'buffer';
global.Buffer = global.Buffer || Buffer;

import {AppRegistry} from 'react-native';
import App from './App';

AppRegistry.registerComponent('SolanaMobileScaffold', () => App);
