import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/realtime/supabase_service.dart';
import '../../core/storage/secure_storage_service.dart';
import 'auth_repository.dart';

enum AuthStatus { initial, loading, otpSent, authenticated, unauthenticated, error }

class AuthState {
  final AuthStatus status;
  final String? mobile;
  final SessionData? session;
  final String? errorMessage;

  const AuthState({
    this.status = AuthStatus.initial,
    this.mobile,
    this.session,
    this.errorMessage,
  });

  String get maskedMobile {
    if (mobile == null || mobile!.length < 10) return mobile ?? '';
    return '${mobile!.substring(0, 2)}******${mobile!.substring(8)}';
  }

  AuthState copyWith({
    AuthStatus? status,
    String? mobile,
    SessionData? session,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      mobile: mobile ?? this.mobile,
      session: session ?? this.session,
      errorMessage: errorMessage,
    );
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository());

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(ref.watch(authRepositoryProvider));
});

class AuthController extends StateNotifier<AuthState> {
  final AuthRepository _repository;

  AuthController(this._repository) : super(const AuthState());

  Future<void> checkExistingSession() async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final session = await _repository.getExistingSession();
      if (session != null) {
        state = state.copyWith(
          status: AuthStatus.authenticated,
          session: session,
        );
      } else {
        state = state.copyWith(status: AuthStatus.unauthenticated);
      }
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        errorMessage: e.toString(),
      );
    }
  }

  Future<bool> loginWithMobile(String mobile) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    try {
      final session = await _repository.loginWithMobile(mobile);
      state = state.copyWith(
        status: AuthStatus.authenticated,
        mobile: mobile,
        session: session,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
      return false;
    }
  }

  Future<bool> sendOtp(String mobile) async {
    state = state.copyWith(status: AuthStatus.loading, mobile: mobile, errorMessage: null);
    try {
      final session = await _repository.loginWithMobile(mobile);
      state = state.copyWith(
        status: AuthStatus.otpSent,
        mobile: mobile,
        session: session,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
      return false;
    }
  }

  Future<bool> verifyOtp(String otp) async {
    state = state.copyWith(status: AuthStatus.loading, errorMessage: null);
    if (state.session != null) {
      state = state.copyWith(status: AuthStatus.authenticated);
      return true;
    }
    state = state.copyWith(
      status: AuthStatus.error,
      errorMessage: 'Invalid OTP session',
    );
    return false;
  }

  Future<void> updateAvatar(String? newAvatarUrl) async {
    if (state.session != null) {
      final updatedSession = state.session!.copyWith(avatarUrl: newAvatarUrl);
      await SecureStorageService.saveSession(
        token: 'token_${state.session!.userId}',
        session: updatedSession,
      );
      state = state.copyWith(session: updatedSession);
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

final waiterOnlineStatusProvider = StateNotifierProvider<WaiterOnlineNotifier, bool>((ref) {
  return WaiterOnlineNotifier(ref);
});

class WaiterOnlineNotifier extends StateNotifier<bool> {
  final Ref _ref;
  WaiterOnlineNotifier(this._ref) : super(true) {
    _init();
  }

  Future<void> _init() async {
    final session = _ref.read(authControllerProvider).session;
    if (session == null) return;
    try {
      final res = await SupabaseService.client
          .from('employees')
          .select('is_online, availability_status')
          .eq('id', session.userId)
          .maybeSingle();
      if (res != null) {
        state = res['is_online'] == true;
      }
    } catch (_) {}
  }

  Future<void> toggleOnline([bool? targetStatus]) async {
    final session = _ref.read(authControllerProvider).session;
    if (session == null) return;
    final nextStatus = targetStatus ?? !state;
    state = nextStatus;
    try {
      await SupabaseService.client.from('employees').update({
        'is_online': nextStatus,
        'availability_status': nextStatus ? 'available' : 'offline',
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', session.userId);
    } catch (_) {}
  }
}

