from datetime import datetime


def create_notification(
    alert: dict,
    recipient_role: str
):
    """
    Create a notification payload for a user role.
    """

    return {
        "notification_id": (
            f"NOTIF-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
        ),
        "recipient_role": recipient_role.upper(),
        "alert_id": alert.get("alert_id"),
        "region": alert.get("region"),
        "severity": alert.get("severity"),
        "title": alert.get("title"),
        "message": alert.get("message"),
        "timestamp": datetime.utcnow().isoformat(),
        "read": False,
    }


def create_role_notifications(
    alert: dict
):
    """
    Create notifications for all dashboard roles.
    """

    roles = [
        "USER",
        "GOVERNMENT",
        "ADMIN",
    ]

    return [
        create_notification(
            alert,
            role
        )
        for role in roles
    ]