import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:waiter_app/core/widgets/app_button.dart';
import 'package:waiter_app/core/widgets/quantity_stepper.dart';
import 'package:waiter_app/core/widgets/status_badge.dart';

void main() {
  testWidgets('AppButton renders label and responds to tap', (WidgetTester tester) async {
    bool tapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AppButton(
            label: 'Send to Kitchen',
            onPressed: () => tapped = true,
          ),
        ),
      ),
    );

    expect(find.text('Send to Kitchen'), findsOneWidget);
    await tester.tap(find.text('Send to Kitchen'));
    expect(tapped, true);
  });

  testWidgets('StatusBadge renders appropriate badge label', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: StatusBadge(status: 'cooking'),
        ),
      ),
    );

    expect(find.text('Preparing'), findsOneWidget);
  });

  testWidgets('QuantityStepper renders ADD button when quantity is 0', (WidgetTester tester) async {
    bool incremented = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: QuantityStepper(
            quantity: 0,
            onIncrement: () => incremented = true,
            onDecrement: () {},
          ),
        ),
      ),
    );

    expect(find.text('ADD'), findsOneWidget);
    await tester.tap(find.text('ADD'));
    expect(incremented, true);
  });
}
