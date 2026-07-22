-- Hard-delete all customer account data (GDPR-style self-service deletion).
-- Called from the customer delete-account API before auth.users removal.

CREATE OR REPLACE FUNCTION public.delete_customer_account_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_lower TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  SELECT lower(trim(email))
  INTO v_email_lower
  FROM profiles
  WHERE id = p_user_id;

  IF v_email_lower IS NULL OR v_email_lower = '' THEN
    SELECT lower(trim(email))
    INTO v_email_lower
    FROM auth.users
    WHERE id = p_user_id;
  END IF;

  IF v_email_lower IS NULL OR v_email_lower = '' THEN
    RAISE EXCEPTION 'Customer profile not found';
  END IF;

  -- Conversations and messaging
  DELETE FROM customer_conversation_messages
  WHERE conversation_id IN (
    SELECT id FROM customer_conversations WHERE user_id = p_user_id
  );

  DELETE FROM customer_conversations WHERE user_id = p_user_id;
  DELETE FROM customer_messages WHERE user_id = p_user_id;

  -- Cart
  DELETE FROM cart_items
  WHERE cart_id IN (SELECT id FROM customer_carts WHERE user_id = p_user_id);

  DELETE FROM customer_carts WHERE user_id = p_user_id;

  -- Notifications and saved vehicles
  DELETE FROM customer_notifications WHERE user_id = p_user_id;
  DELETE FROM saved_vehicles WHERE user_id = p_user_id;

  -- Vehicle engagement
  DELETE FROM vehicle_availability_notifications
  WHERE lower(trim(email)) = v_email_lower;

  DELETE FROM vehicle_interest
  WHERE user_id = p_user_id
     OR lower(trim(coalesce(email, ''))) = v_email_lower;

  DELETE FROM price_alerts
  WHERE user_id = p_user_id
     OR lower(trim(email)) = v_email_lower;

  -- Appointments (before orders/inquiries they may reference)
  DELETE FROM vehicle_appointments
  WHERE user_id = p_user_id
     OR lower(trim(email)) = v_email_lower;

  -- Orders
  DELETE FROM parts_order_items
  WHERE order_id IN (
    SELECT id FROM parts_orders
    WHERE user_id = p_user_id
       OR lower(trim(email)) = v_email_lower
  );

  DELETE FROM parts_orders
  WHERE user_id = p_user_id
     OR lower(trim(email)) = v_email_lower;

  -- Shipments
  DELETE FROM shipment_timeline_events
  WHERE shipment_id IN (
    SELECT id FROM shipment_tracking
    WHERE user_id = p_user_id
       OR lower(trim(coalesce(customer_email, ''))) = v_email_lower
  );

  DELETE FROM shipment_tracking
  WHERE user_id = p_user_id
     OR lower(trim(coalesce(customer_email, ''))) = v_email_lower;

  -- Inquiries and quotes
  DELETE FROM freight_quote_requests
  WHERE user_id = p_user_id
     OR lower(trim(email)) = v_email_lower;

  DELETE FROM preorder_inquiries
  WHERE user_id = p_user_id
     OR lower(trim(email)) = v_email_lower;

  DELETE FROM finance_applications
  WHERE user_id = p_user_id
     OR lower(trim(email)) = v_email_lower;

  DELETE FROM contact_inquiries
  WHERE lower(trim(email)) = v_email_lower;

  DELETE FROM vehicle_inquiries
  WHERE lower(trim(email)) = v_email_lower;

  DELETE FROM newsletter_subscribers
  WHERE lower(trim(email)) = v_email_lower;

  -- Soft-delete tracking and admin trash snapshots
  DELETE FROM deleted_customer_emails
  WHERE lower(trim(email)) = v_email_lower;

  DELETE FROM platform_trash
  WHERE entity_type = 'customer'
    AND (
      entity_id = p_user_id::text
      OR entity_id = 'email:' || v_email_lower
    );

  DELETE FROM profiles WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_customer_account_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_customer_account_data(UUID) TO service_role;

COMMENT ON FUNCTION public.delete_customer_account_data(UUID) IS
  'Removes all public-schema customer data for self-service account deletion.';
