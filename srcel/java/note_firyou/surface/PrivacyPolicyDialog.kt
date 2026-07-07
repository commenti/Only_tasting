// File: app/src/main/java/com/yourname/githubmanager/ui/components/PrivacyPolicyDialog.kt
package com.yourname.githubmanager.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.yourname.githubmanager.ui.theme.GitHubManagerTheme

/**
 * Explains, in plain language, what the app does and does not do with the
 * user's data:
 *  - GitHub repo owner/name and Personal Access Token are processed and
 *    stored locally on-device only (token is encrypted at rest); nothing
 *    is sent to any server owned by this app or its developer.
 *  - The app shows ads via Google AdMob, which may collect data per its
 *    own policy, independent of the GitHub-related data above.
 *
 * @param onDismiss Invoked when the dialog is dismissed — by tapping
 *                  "Close", tapping outside the dialog, or pressing back.
 */
@Composable
fun PrivacyPolicyDialog(
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Privacy & Data Usage",
                style = MaterialTheme.typography.titleLarge
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = "Local processing",
                    style = MaterialTheme.typography.titleSmall
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Your GitHub repository owner/name and your " +
                        "Personal Access Token are stored only on this " +
                        "device. The token is kept in encrypted storage " +
                        "and is used solely to talk to the GitHub API " +
                        "directly from your device. We do not run our " +
                        "own servers and never see or transmit your " +
                        "token or repository data ourselves.",
                    style = MaterialTheme.typography.bodyMedium
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Advertising (Google AdMob)",
                    style = MaterialTheme.typography.titleSmall
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "This app shows ads through Google AdMob. " +
                        "AdMob may collect device and usage data to " +
                        "show and measure ads, in accordance with " +
                        "Google's own privacy policy. This data " +
                        "collection is separate from, and unrelated " +
                        "to, your GitHub repo owner/name and token, " +
                        "which stay on-device as described above.",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(text = "Close")
            }
        }
    )
}

@Preview(showBackground = true)
@Composable
private fun PrivacyPolicyDialogPreview() {
    GitHubManagerTheme {
        PrivacyPolicyDialog(onDismiss = {})
    }
}
