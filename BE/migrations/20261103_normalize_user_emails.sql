DO $$
BEGIN
    IF EXISTS (
        SELECT lower(btrim(email))
        FROM public.users
        GROUP BY lower(btrim(email))
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot normalize user emails: duplicate addresses exist when compared case-insensitively.';
    END IF;
END;
$$;

UPDATE public.users
SET email = lower(btrim(email))
WHERE email <> lower(btrim(email));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key
    ON public.users (lower(email));
