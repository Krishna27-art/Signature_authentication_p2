import 'package:flutter_test/flutter_test.dart';
import 'package:sigauth_proto2/app.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const SigAuthApp());

    // Verify that the splash screen text is present.
    expect(find.text('SigAuth'), findsOneWidget);
  });
}
