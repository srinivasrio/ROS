import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../config/app_config.dart';
import '../storage/secure_storage_service.dart';

class ApiClient {
  late final Dio dio;

  ApiClient({String? baseUrl}) {
    dio = Dio(
      BaseOptions(
        baseUrl: baseUrl ?? (kIsWeb ? AppConfig.fallbackApiUrl : AppConfig.baseApiUrl),
        connectTimeout: const Duration(seconds: 12),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await SecureStorageService.getToken();
          final session = await SecureStorageService.getSession();

          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
            options.headers['x-dine-token'] = token;
          }
          if (session?.restaurantId != null) {
            options.headers['x-restaurant-id'] = session!.restaurantId;
          }

          return handler.next(options);
        },
        onError: (DioException error, handler) {
          debugPrint('[ApiClient] Error: ${error.type} - ${error.message} - ${error.response?.data}');
          return handler.next(error);
        },
      ),
    );
  }

  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    return await dio.get(path, queryParameters: queryParameters);
  }

  Future<Response> post(String path, {dynamic data, Map<String, dynamic>? queryParameters}) async {
    return await dio.post(path, data: data, queryParameters: queryParameters);
  }

  Future<Response> put(String path, {dynamic data, Map<String, dynamic>? queryParameters}) async {
    return await dio.put(path, data: data, queryParameters: queryParameters);
  }

  Future<Response> delete(String path, {dynamic data, Map<String, dynamic>? queryParameters}) async {
    return await dio.delete(path, data: data, queryParameters: queryParameters);
  }
}
