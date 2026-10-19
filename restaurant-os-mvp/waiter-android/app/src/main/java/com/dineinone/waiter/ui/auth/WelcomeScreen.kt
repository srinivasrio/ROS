package com.dineinone.waiter.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dineinone.waiter.ui.components.DineWordmark
import com.dineinone.waiter.ui.theme.*

@Composable
fun WelcomeScreen(onGetStarted: () -> Unit) {
    Surface(Modifier.fillMaxSize(), color = LavenderSoft) {
        Column(
            Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(24.dp),
        ) {
            // Brand header
            Box(Modifier.fillMaxWidth().height(56.dp), contentAlignment = Alignment.CenterStart) {
                DineWordmark(fontSize = 22.sp)
            }

            Spacer(Modifier.weight(1f))

            // Center headline & Welcome message
            Column(
                Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    "Welcome to",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight(700),
                    color = InkPrimary,
                )
                Spacer(Modifier.height(8.dp))
                DineWordmark(fontSize = 36.sp)

                Spacer(Modifier.height(36.dp))

                // Get Started -> button (Page 1 & 21: 56px PrimaryButton with arrow)
                Button(
                    onClick = onGetStarted,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = LavenderChip,
                        contentColor = PurpleDeep,
                    ),
                    elevation = null,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                    ) {
                        Text("Get Started", fontWeight = FontWeight(700), fontSize = 16.sp)
                        Spacer(Modifier.width(8.dp))
                        Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
                    }
                }
            }

            Spacer(Modifier.weight(1.2f))
        }
    }
}
