import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/feedback_utils.dart';
import '../../core/widgets/app_button.dart';
import '../navigation/main_navigation_screen.dart';
import 'auth_controller.dart';

class MobileLoginScreen extends ConsumerStatefulWidget {
  const MobileLoginScreen({super.key});

  @override
  ConsumerState<MobileLoginScreen> createState() => _MobileLoginScreenState();
}

class _MobileLoginScreenState extends ConsumerState<MobileLoginScreen> {
  final TextEditingController _identifierController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  String? _inlineError;

  @override
  void dispose() {
    _identifierController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final identifier = _identifierController.text.trim();
    if (identifier.isEmpty) {
      FeedbackUtils.heavyHaptic();
      setState(() {
        _inlineError = 'Please enter your mobile number or employee ID';
      });
      return;
    }

    setState(() {
      _inlineError = null;
    });

    final success = await ref.read(authControllerProvider.notifier).loginWithMobile(identifier);
    if (!mounted) return;

    if (success) {
      FeedbackUtils.successHaptic();
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
        (route) => false,
      );
    } else {
      FeedbackUtils.heavyHaptic();
      final err = ref.read(authControllerProvider).errorMessage ?? 'Sign-in failed. Please check your credentials.';
      setState(() {
        _inlineError = err;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState.status == AuthStatus.loading;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // w-canvas
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Logo tile matching Web: size-16 rounded-[20px] bg-w-brand
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF6B35), // w-brand
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x4DFF6B35),
                          blurRadius: 20,
                          offset: Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Icon(
                        LucideIcons.utensilsCrossed,
                        size: 32,
                        color: Colors.white,
                      ),
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Header title
                  const Text(
                    'Waiter Sign In',
                    style: TextStyle(
                      fontFamily: 'Outfit',
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A), // w-ink
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Enter your registered staff mobile number or employee ID to access your shift.',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF475569), // w-ink-soft
                      height: 1.45,
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Input label
                  const Text(
                    'STAFF MOBILE NUMBER OR EMPLOYEE ID',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                      color: Color(0xFF475569), // w-ink-soft
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Input box matching Web
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: _inlineError != null
                            ? const Color(0xFFEF4444)
                            : (_focusNode.hasFocus ? const Color(0xFFFF6B35) : const Color(0xFFE2E8F0)),
                        width: 1.5,
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x0F0F172A),
                          blurRadius: 10,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        // Left user icon divider
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: const BoxDecoration(
                            border: Border(
                              right: BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
                            ),
                          ),
                          child: const Icon(
                            LucideIcons.user,
                            size: 18,
                            color: Color(0xFF475569),
                          ),
                        ),

                        // Text Field
                        Expanded(
                          child: TextField(
                            controller: _identifierController,
                            focusNode: _focusNode,
                            autofocus: false,
                            textInputAction: TextInputAction.done,
                            onSubmitted: (_) => _handleLogin(),
                            onChanged: (_) {
                              if (_inlineError != null) {
                                setState(() {
                                  _inlineError = null;
                                });
                              }
                            },
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                            decoration: const InputDecoration(
                              hintText: 'e.g. 9876543210 or EMP-0001',
                              hintStyle: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.normal,
                                color: Color(0xFF94A3B8), // w-muted
                              ),
                              contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Inline error if any
                  if (_inlineError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _inlineError!,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFEF4444), // w-alert
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),

                  // CTA Button matching Web
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFF6B35), // w-brand
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shadowColor: Colors.transparent,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      onPressed: isLoading ? null : _handleLogin,
                      child: isLoading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Enter Waiter Panel',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.2,
                                  ),
                                ),
                                SizedBox(width: 8),
                                Icon(LucideIcons.arrowRight, size: 18),
                              ],
                            ),
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Info banner matching Web: ShieldCheck + text
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
                    ),
                    child: const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(LucideIcons.shieldCheck, size: 20, color: Color(0xFFFF6B35)),
                        SizedBox(width: 12),
                        Expanded(
                          child: Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(
                                  text: 'Instant Staff Access: ',
                                  style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                                ),
                                TextSpan(
                                  text: 'Enter your mobile number or employee ID to sign in. No password required.',
                                  style: TextStyle(color: Color(0xFF475569)),
                                ),
                              ],
                            ),
                            style: TextStyle(fontSize: 12, height: 1.45),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
