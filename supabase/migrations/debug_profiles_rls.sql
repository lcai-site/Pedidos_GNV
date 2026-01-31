-- Verificar políticas RLS da tabela profiles
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- Verificar se RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

-- Testar query diretamente
SELECT * FROM profiles WHERE id = '0164bf84-15e4-40fa-96d1-d16a36192296';
