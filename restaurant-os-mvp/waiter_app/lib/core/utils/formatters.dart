import 'package:intl/intl.dart';

class Formatters {
  static final NumberFormat _currencyFormatter = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );

  static final NumberFormat _decimalCurrencyFormatter = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 2,
  );

  static String formatCurrency(num? amount, {bool showDecimals = false}) {
    if (amount == null) return '₹0';
    return showDecimals 
        ? _decimalCurrencyFormatter.format(amount)
        : _currencyFormatter.format(amount);
  }

  static String formatPrice(num? amount, {bool showDecimals = false}) {
    return formatCurrency(amount, showDecimals: showDecimals);
  }

  static String formatElapsed(DateTime? startTime) {
    if (startTime == null) return '';
    final duration = DateTime.now().difference(startTime);
    if (duration.inMinutes < 1) return 'Just now';
    if (duration.inMinutes < 60) return '${duration.inMinutes}m';
    final hours = duration.inHours;
    final mins = duration.inMinutes % 60;
    return '${hours}h ${mins}m';
  }

  static String formatLiveTimer(DateTime? startTime) {
    if (startTime == null) return '00:00';
    final diff = DateTime.now().difference(startTime);
    if (diff.isNegative) return '00:00';
    final totalSecs = diff.inSeconds;
    final mins = totalSecs ~/ 60;
    final secs = totalSecs % 60;
    if (mins < 60) {
      return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
    } else {
      final hours = mins ~/ 60;
      final remMins = mins % 60;
      return '${hours}h ${remMins.toString().padLeft(2, '0')}m';
    }
  }

  static String formatElapsedTime(DateTime? startTime) {
    return formatElapsed(startTime);
  }

  static String formatOrderTime(DateTime? date) {
    if (date == null) return '';
    return DateFormat('hh:mm a').format(date);
  }
}

typedef AppFormatters = Formatters;
